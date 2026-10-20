const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const {
  validateRequest,
  readJson,
} = require("../../../deploy-controller/dsm-request.cjs");
function fixture() {
  const m = {
    schema: 2,
    status: "QUALIFIED",
    candidate: "2.2.0-rc.9",
    commit: "a".repeat(40),
    archiveSha256: "b".repeat(64),
    platform: "linux/amd64",
    runId: "123",
    exceptionReviewBy: "2099-01-01",
    images: Object.fromEntries(
      ["backend", "frontend"].map((s) => [
        s,
        {
          architecture: "amd64",
          user: s === "backend" ? "1028:100" : "nginx",
          localTag: "suivi-cb-ci-" + s + ":2.2.0-rc.9",
          localId: "sha256:" + "c".repeat(64),
          configDigest: "sha256:" + "d".repeat(64),
        },
      ]),
    ),
  };
  const approval = {
    target: "preproduction",
    approved: true,
    approvedBy: "operator",
    approvedAt: new Date(Date.now() - 1000).toISOString(),
    candidate: m.candidate,
    commit: m.commit,
    archiveSha256: m.archiveSha256,
    runId: m.runId,
  };
  const request = {
    schema: 1,
    nonce: crypto.randomUUID(),
    action: "plan",
    identity: "e".repeat(64),
    candidate: m.candidate,
    commit: m.commit,
    archiveSha256: m.archiveSha256,
    requestedAt: new Date().toISOString(),
  };
  return { m, approval, request };
}
test("DSM accepts only a fresh exact preproduction request with installed approval", () => {
  const { m, approval, request } = fixture();
  assert.equal(validateRequest(request, m, approval), request);
  for (const change of [
    { action: "production" },
    { action: "rollback" },
    { script: "rm -rf /" },
    { nonce: "../escape" },
    { identity: "bad" },
    { commit: "f".repeat(40) },
    { archiveSha256: "f".repeat(64) },
    { candidate: "2.2.0-rc.10" },
    { requestedAt: new Date(Date.now() - 16 * 60000).toISOString() },
    { requestedAt: new Date(Date.now() + 120000).toISOString() },
  ])
    assert.throws(() =>
      validateRequest({ ...request, ...change }, m, approval),
    );
  assert.throws(() =>
    validateRequest(request, m, { ...approval, approved: false }),
  );
  assert.throws(() =>
    validateRequest(request, { ...m, status: "BUILT" }, approval),
  );
});
test("DSM parsing rejects oversized requests and non-files", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dsm-json-test-"));
  try {
    const file = path.join(dir, "request.json");
    fs.writeFileSync(file, "x".repeat(8193));
    assert.throws(() => readJson(file), /UNSAFE/);
    assert.throws(() => readJson(dir), /UNSAFE/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
module.exports = { fixture };
