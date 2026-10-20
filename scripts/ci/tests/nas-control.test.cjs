const { test } = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const sqlite = require("../../../backend/node_modules/sqlite3");
const { snapshot } = require("../../../deploy-controller/sqlite-snapshot.cjs");
const {
  verifyEnvironment,
  verifyApproval,
} = require("../../../deploy-controller/validate-bundle.cjs");
const env =
  "KEYCLOAK_URL=https://auth.jolurie.com\nKEYCLOAK_REALM=suivi-cb-preprod\nKEYCLOAK_CLIENT_ID=suivi-cb-web\nKEYCLOAK_AUDIENCE=suivi-cb-api\n";
test("NAS control refuses production realm, injected environment settings and unapproved bundles", () => {
  assert.doesNotThrow(() => verifyEnvironment(env));
  for (const invalid of [
    env.replace("suivi-cb-preprod", "suivi-cb"),
    env + "DB_PATH=/production/database.db\n",
    env + "KEYCLOAK_REALM=suivi-cb-preprod\n",
  ])
    assert.throws(() => verifyEnvironment(invalid));
  assert.throws(() => verifyApproval({ status: "BUILT" }, {}));
});
test("online SQLite snapshot is consistent, retains subsequent writes and never overwrites a snapshot", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "suivi-snapshot-"));
  let db;
  const run = (sql) =>
    new Promise((resolve, reject) =>
      db.run(sql, (e) => (e ? reject(e) : resolve())),
    );
  try {
    db = await new Promise((resolve, reject) => {
      const d = new sqlite.Database(path.join(dir, "source.db"), (e) =>
        e ? reject(e) : resolve(d),
      );
    });
    await run("PRAGMA journal_mode=WAL");
    await run("CREATE TABLE records (id INTEGER PRIMARY KEY)");
    await run("INSERT INTO records VALUES (1)");
    const dest = path.join(dir, "snapshot.db");
    const result = await snapshot(path.join(dir, "source.db"), dest, sqlite);
    assert.equal(result.status, "PASS");
    assert.match(result.sha256, /^[a-f0-9]{64}$/);
    await run("INSERT INTO records VALUES (2)");
    await assert.rejects(
      () => snapshot(path.join(dir, "source.db"), dest, sqlite),
      /ALREADY_EXISTS/,
    );
    const count = await new Promise((resolve, reject) =>
      db.get("SELECT count(*) n FROM records", (e, row) =>
        e ? reject(e) : resolve(row.n),
      ),
    );
    assert.equal(count, 2);
    const copy = await new Promise((resolve, reject) => {
      const d = new sqlite.Database(dest, sqlite.OPEN_READONLY, (e) =>
        e ? reject(e) : resolve(d),
      );
    });
    try {
      const saved = await new Promise((resolve, reject) =>
        copy.get("SELECT count(*) n FROM records", (e, row) =>
          e ? reject(e) : resolve(row.n),
        ),
      );
      assert.equal(saved, 1);
    } finally {
      await new Promise((resolve) => copy.close(resolve));
    }
  } finally {
    if (db) await new Promise((resolve) => db.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("NAS approval must identify the exact qualified candidate and a dated operator approval", () => {
  const m = {
    schema: 2,
    status: "QUALIFIED",
    candidate: "2.2.0-rc.99",
    platform: "linux/amd64",
    commit: "a".repeat(40),
    archiveSha256: "b".repeat(64),
    runId: "99",
    exceptionReviewBy: "2099-01-01",
    images: {},
  };
  for (const key of ["backend", "frontend"])
    m.images[key] = {
      architecture: "amd64",
      localId: "sha256:" + "c".repeat(64),
      configDigest: "sha256:" + "d".repeat(64),
      localTag: "suivi-cb-ci-" + key + ":" + m.candidate,
      user: key === "backend" ? "1028:100" : "nginx",
    };
  const approval = {
    target: "preproduction",
    candidate: m.candidate,
    commit: m.commit,
    archiveSha256: m.archiveSha256,
    runId: m.runId,
    approved: true,
    approvedBy: "Djone",
    approvedAt: "2026-01-01T00:00:00Z",
  };
  assert.doesNotThrow(() => verifyApproval(m, approval));
  for (const patch of [
    { approved: false },
    { candidate: "2.2.0-rc.98" },
    { commit: "e".repeat(40) },
    { archiveSha256: "f".repeat(64) },
    { runId: "98" },
    { approvedBy: "" },
    { approvedAt: "invalid" },
    { approvedAt: "2099-01-01T00:00:00Z" },
  ])
    assert.throws(
      () => verifyApproval(m, { ...approval, ...patch }),
      /NAS_APPROVAL/,
    );
  assert.throws(
    () => verifyApproval({ ...m, exceptionReviewBy: "2000-01-01" }, approval),
    /EXCEPTION/,
  );
});
