const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { loopbackOrigin, redact } = require("./safety.cjs");
test("reject remote URLs, credentials and paths before any HTTP request", () => {
  for (const u of [
    "https://finances.jolurie.com",
    "http://localhost:4200",
    "http://127.0.0.1:4200/api",
    "http://user:password@127.0.0.1:4200",
    "http://127.0.0.1:4200/?token=x",
  ])
    assert.throws(() => loopbackOrigin(u));
  assert.equal(
    loopbackOrigin("http://127.0.0.1:49123"),
    "http://127.0.0.1:49123",
  );
});
test("redact passwords and JWTs from diagnostics", () => {
  assert.equal(
    redact("password123 eyJabc.abc.def", ["password123"]),
    "[REDACTED] [TOKEN]",
  );
});

test("a green runner cannot hide skipped, failed or missing mandatory journeys", () => {
  const { requiredReport } = require("./safety.cjs");
  const report = {
    status: "passed",
    tests: Array.from({ length: 8 }, () => ({ status: "passed" })),
  };
  assert.doesNotThrow(() => requiredReport(report));
  for (const state of ["skipped", "failed", "timedOut"])
    assert.throws(() =>
      requiredReport({
        ...report,
        tests: [...report.tests.slice(1), { status: state }],
      }),
    );
  assert.throws(() =>
    requiredReport({ ...report, tests: report.tests.slice(1) }),
  );
});
