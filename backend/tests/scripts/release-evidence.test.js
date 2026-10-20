const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { createReleaseEvidence } = require("../../services/release-evidence");
const {
  createEvidenceRouter,
} = require("../../routes/release-evidence.routes");
const express = require("express");
const {
  requireLocalReleaseAccess,
} = require("../../middlewares/release-access.middleware");
const sha = (x) => crypto.createHash("sha256").update(x).digest("hex");
let root, dir, manifest, service, repository;
function write(name, value) {
  fs.writeFileSync(
    path.join(dir, name),
    typeof value === "string" ? value : JSON.stringify(value),
  );
}
function checksums() {
  write(
    "SHA256SUMS",
    fs
      .readdirSync(dir)
      .filter((x) => x !== "SHA256SUMS")
      .map((x) => sha(fs.readFileSync(path.join(dir, x))) + "  " + x)
      .join("\n") + "\n",
  );
}
function setup() {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "release-evidence-"));
  dir = path.join(root, ".cache/ci/package");
  fs.mkdirSync(dir, { recursive: true });
  repository = { commit: "a".repeat(40), clean: true };
  manifest = {
    schema: 2,
    status: "QUALIFIED",
    candidate: "2.2.0-rc.99",
    commit: repository.commit,
    platform: "linux/amd64",
    archiveSha256: sha("synthetic archive"),
    runId: "99",
    exceptionReviewBy: "2099-01-01",
    images: {},
  };
  for (const k of ["backend", "frontend"])
    manifest.images[k] = {
      localId: "sha256:" + k[0].repeat(64),
      configDigest: "sha256:" + k[0].repeat(64),
      localTag: "suivi-cb-ci-" + k + ":" + manifest.candidate,
      user: k === "backend" ? "1028:100" : "nginx",
      architecture: "amd64",
    };
  // Frontend digest must be hexadecimal.
  manifest.images.frontend.localId = manifest.images.frontend.configDigest =
    "sha256:" + "f".repeat(64);
  write("images.tar", "synthetic archive");
  write("manifest.json", manifest);
  write("quality.json", {
    status: "PASS",
    sourceDirty: false,
    commit: manifest.commit,
    runId: "99",
    checks: [
      "lint",
      "typecheck",
      "test:ci:policy",
      "test:candidate",
      "test:e2e:safety",
      "backend-unit-coverage",
      "backend-test:auth",
      "backend-test:security",
      "frontend-unit",
      "dependency-gates",
    ].map((name) => ({ name, status: "PASS" })),
  });
  write("e2e-qualification.json", {
    status: "PASS",
    cleanup: { status: "PASS" },
    source: { commit: manifest.commit, dirty: false },
    images: [
      { id: manifest.images.backend.localId },
      { id: manifest.images.frontend.localId },
    ],
  });
  write("e2e-tests.json", {
    status: "passed",
    tests: Array.from({ length: 8 }, () => ({ status: "passed" })),
  });
  write("rollback.json", {
    status: "PASS",
    backend: manifest.images.backend.localId,
    frontend: manifest.images.frontend.localId,
  });
  write("keycloak.json", { status: "PASS", checks: Array(8).fill("checked") });
  write("inspection.json", {
    archiveSha256: manifest.archiveSha256,
    images: Object.values(manifest.images).map((i) => ({
      configDigest: i.configDigest,
      user: i.user,
      sensitivePaths: [],
      sourceDifferences: [],
    })),
  });
  for (const k of ["source", "backend", "frontend"])
    write(k + "-scan.json", {
      status: "PASS",
      commit: manifest.commit,
      configDigest: k === "source" ? null : manifest.images[k].configDigest,
      vulnerabilities: [],
      secrets: [],
    });
  for (const k of ["backend", "frontend"])
    write(k + ".cdx.json", {
      bomFormat: "CycloneDX",
      components: [{ name: k }],
    });
  checksums();
  const policy = path.join(root, "docs/audit/2026-10-15");
  fs.mkdirSync(policy, { recursive: true });
  fs.writeFileSync(
    path.join(policy, "dependency-risk-acceptance.json"),
    JSON.stringify({ accepted: true, reviewBy: "2099-01-01" }),
  );
  service = createReleaseEvidence({ root, repository: () => repository });
}
const importIt = () => service.importBundle({ source: "local" }, "operator");
const update = (r, extra) =>
  service.update(
    { identity: r.dossier.identity, revision: r.dossier.revision, ...extra },
    "operator",
  );
const scope = (r) =>
  update(r, {
    action: "scope",
    scope: { summary: "Lot 3", releaseNotes: "Evidence ledger", frozen: true },
  });
const attest = (r, check, approved = true) =>
  update(r, {
    action: "validate",
    check,
    approved,
    reference: "NAS report #99",
  });
beforeEach(setup);
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
it("imports checksummed proofs, persists across service restarts and keeps production locked", async () => {
  let r = await importIt();
  expect(r.dossier.origin.authenticatedGithubProvenance).toBe(false);
  expect(r.readyForPreproduction).toBe(false);
  r = await scope(r);
  r = await attest(r, "source-review");
  expect(r.readyForPreproduction).toBe(true);
  expect(r.readyForProduction).toBe(false);
  expect(r.canClose).toBe(false);
  expect(
    createReleaseEvidence({ root, repository: () => repository }).read().dossier
      .identity,
  ).toBe(r.dossier.identity);
  await expect(attest(r, "production-approval")).rejects.toThrow(
    "PRODUCTION_BLOCKED",
  );
  await expect(update(r, { action: "close" })).rejects.toThrow(
    "CLOSURE_BLOCKED",
  );
});
it("detects tampering and rejects arbitrary import sources and traversal run IDs", async () => {
  write("quality.json", { status: "PASS" });
  await expect(importIt()).rejects.toThrow("CHECKSUM_FAILED");
  for (const source of ["../../", "/etc", "http"])
    await expect(service.importBundle({ source }, "operator")).rejects.toThrow(
      "INVALID_IMPORT_SOURCE",
    );
  await expect(
    service.importBundle({ source: "github", runId: "../99" }, "operator"),
  ).rejects.toThrow("INVALID_RUN_ID");
  expect(service.read().dossier).toBeNull();
});
it("imports metadata with a missing archive as incomplete instead of pretending full integrity", async () => {
  fs.unlinkSync(path.join(dir, "images.tar"));
  const r = await importIt();
  expect(r.blockers.some((b) => b.id === "archive")).toBe(true);
  expect(r.readyForPreproduction).toBe(false);
});
it("rejects symlinks in artifact inventory", async () => {
  fs.unlinkSync(path.join(dir, "quality.json"));
  fs.symlinkSync(root, path.join(dir, "quality.json"), "junction");
  await expect(importIt()).rejects.toThrow("CHECKSUM_FAILED");
});
it("blocks dirty worktrees, foreign commits, expired exceptions and foreign image evidence", async () => {
  write("e2e-qualification.json", {
    status: "PASS",
    cleanup: { status: "PASS" },
    source: { commit: manifest.commit, dirty: false },
    images: [{ id: "foreign" }],
  });
  checksums();
  const r = await importIt();
  expect(r.blockers.some((b) => b.id === "e2e")).toBe(true);
  repository.clean = false;
  repository.commit = "e".repeat(40);
  let state = service.read();
  expect(state.blockers.map((b) => b.id)).toEqual(
    expect.arrayContaining(["repository", "source-current"]),
  );
  const policy = path.join(
    root,
    "docs/audit/2026-10-15/dependency-risk-acceptance.json",
  );
  fs.writeFileSync(
    policy,
    JSON.stringify({ accepted: true, reviewBy: "2000-01-01" }),
  );
  state = service.read();
  expect(state.blockers.some((b) => b.id === "exceptions")).toBe(true);
});
it("rejects stale browser updates and invalidates attestations on scope/proof/candidate changes", async () => {
  let r = await importIt();
  const stale = r;
  r = await scope(r);
  await expect(attest(stale, "source-review")).rejects.toThrow("STALE_DOSSIER");
  r = await attest(r, "source-review");
  r = await scope(r);
  expect(r.dossier.validations).toEqual({});
  r = await attest(r, "source-review");
  write("keycloak.json", { status: "FAIL", checks: [] });
  checksums();
  r = await importIt();
  expect(r.dossier.validations).toEqual({});
  expect(r.blockers.some((b) => b.id === "keycloak")).toBe(true);
  manifest.commit = "e".repeat(40);
  write("manifest.json", manifest);
  checksums();
  r = await importIt();
  expect(r.dossier.scope.frozen).toBe(false);
  expect(
    fs.readdirSync(path.join(root, "data/release/evidence/history")).length,
  ).toBeGreaterThan(1);
});
it("does not accept preproduction approval before all NAS checks, and revocation removes approvals", async () => {
  let r = await scope(await importIt());
  r = await attest(r, "source-review");
  await expect(attest(r, "preproduction-approval")).rejects.toThrow(
    "PREPRODUCTION_BLOCKED",
  );
  for (const k of [
    "nas-identity",
    "nas-auth",
    "nas-business",
    "nas-recovery",
    "operations-rights",
  ])
    r = await attest(r, k);
  r = await attest(r, "preproduction-approval");
  expect(r.dossier.validations["preproduction-approval"].approved).toBe(true);
  r = await attest(r, "nas-auth", false);
  expect(r.dossier.validations["preproduction-approval"]).toBeUndefined();
  expect(r.readyForProduction).toBe(false);
});
it("never persists arbitrary manifest fields such as tokens", async () => {
  manifest.secret = "sensitive-value";
  write("manifest.json", manifest);
  checksums();
  const r = await importIt();
  expect(r.dossier.manifest.secret).toBeUndefined();
  expect(JSON.stringify(service.read())).not.toContain("sensitive-value");
});
it("serves reports without executing commands and blocks non-loopback callers", async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.auth = { sub: "reviewer" };
    next();
  });
  app.use(
    "/evidence",
    requireLocalReleaseAccess,
    createEvidenceRouter(service),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  try {
    const base = "http://127.0.0.1:" + server.address().port;
    let r = await fetch(base + "/evidence/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "local" }),
    });
    expect(r.status).toBe(200);
    r = await fetch(base + "/evidence/report");
    expect(r.headers.get("cache-control")).toBe("no-store");
    const report = await r.json();
    expect(report.reportType).toBe(
      "release-readiness-not-deployment-authorization",
    );
    expect(report.dossier.importedBy).toBe("reviewer");
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    requireLocalReleaseAccess(
      {
        socket: { remoteAddress: "192.0.2.1" },
        headers: { "x-forwarded-for": "127.0.0.1" },
      },
      res,
      next,
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  } finally {
    await new Promise((r) => server.close(r));
  }
});
it("refuses mutation payloads that bypass identifiers or omit evidence references", async () => {
  const r = await importIt();
  await expect(
    update(r, {
      action: "validate",
      check: "source-review",
      approved: true,
      reference: "",
    }),
  ).rejects.toThrow("REFERENCE_REQUIRED");
  await expect(
    update(r, {
      action: "validate",
      check: "unknown",
      approved: true,
      reference: "x",
    }),
  ).rejects.toThrow("INVALID_VALIDATION");
  await expect(
    update(r, {
      action: "scope",
      scope: { summary: "", releaseNotes: "", frozen: true },
    }),
  ).rejects.toThrow("INVALID_SCOPE");
});

it("archives readiness reports and keeps publication locks effective against legacy payloads", async () => {
  await importIt();
  const r = service.report();
  expect(r.reportType).toBe("release-readiness-not-deployment-authorization");
  expect(
    JSON.parse(
      fs.readFileSync(
        path.join(root, "data/release/evidence/reports", r.reportId + ".json"),
        "utf8",
      ),
    ).publicationEnabled,
  ).toBe(false);
  const controller = require("../../controllers/release.controller");
  for (const body of [
    { command: "deploy" },
    { command: "full" },
    { command: "rollback" },
    { command: "prepare", tag: true },
    { command: "prepare", withNasDeploy: true },
  ]) {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    controller.runReleaseCommand({ body }, res);
    expect(res.status).toHaveBeenCalledWith(423);
    expect(res.json).toHaveBeenCalledWith({ message: "PUBLICATION_LOCKED" });
  }
});
it("refuses saving bearer tokens or private keys as human evidence", async () => {
  const r = await importIt();
  await expect(
    update(r, {
      action: "validate",
      check: "source-review",
      approved: true,
      reference: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.signature",
    }),
  ).rejects.toThrow("REFERENCE_REQUIRED");
  await expect(
    update(r, {
      action: "scope",
      scope: {
        summary: "-----BEGIN PRIVATE KEY-----",
        releaseNotes: "notes",
        frozen: true,
      },
    }),
  ).rejects.toThrow("INVALID_SCOPE");
});

it("preserves the previous dossier and can retry after an atomic replacement failure", async () => {
  const r = await importIt();
  const spy = jest.spyOn(fs, "renameSync").mockImplementationOnce(() => {
    throw Error("DISK_FULL");
  });
  await expect(scope(r)).rejects.toThrow("DISK_FULL");
  spy.mockRestore();
  expect(service.read().dossier.revision).toBe(r.dossier.revision);
  const retried = await scope(r);
  expect(retried.dossier.scope.frozen).toBe(true);
});
it("serializes imports instead of allowing concurrent overwrites", async () => {
  const first = importIt();
  await expect(importIt()).rejects.toThrow("EVIDENCE_BUSY");
  await first;
});

it("persists the next cycle without changing candidate files or existing preproduction evidence", async () => {
  let r = await importIt();
  r = await scope(r);
  r = await update(r, {
    action: "validate",
    check: "source-review",
    approved: true,
    reference: "reviewed",
  });
  const identity = r.dossier.identity;
  const before = fs.readFileSync(path.join(dir, "manifest.json"), "utf8");
  r = await update(r, { action: "release-plan", nextDevVersion: "2.3.0-dev" });
  expect(r.dossier.releasePlan.nextDevVersion).toBe("2.3.0-dev");
  expect(r.dossier.releasePlan.status).toBe("planned");
  expect(r.dossier.identity).toBe(identity);
  expect(r.dossier.validations["source-review"].approved).toBe(true);
  expect(fs.readFileSync(path.join(dir, "manifest.json"), "utf8")).toBe(before);
  expect(service.read().dossier.releasePlan.nextDevVersion).toBe("2.3.0-dev");
  expect(r.publicationEnabled).toBe(false);
  expect(r.canClose).toBe(false);
  const imported = await importIt();
  expect(imported.dossier.releasePlan.nextDevVersion).toBe("2.3.0-dev");
});
it("rejects malformed, identical or older next-cycle versions", async () => {
  const r = await importIt();
  for (const nextDevVersion of [
    "2.3.0",
    "v2.3.0-dev",
    "02.3.0-dev",
    "2.2.0-dev",
    "2.1.9-dev",
    "1.99.0-dev",
    "2.3.0-dev; rm",
    null,
  ])
    await expect(
      update(r, { action: "release-plan", nextDevVersion }),
    ).rejects.toThrow();
  expect(service.read().dossier.releasePlan).toBeNull();
});
