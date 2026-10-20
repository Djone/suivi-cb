const assert = require("node:assert/strict");
function loopbackOrigin(value) {
  const u = new URL(value);
  assert.equal(u.protocol, "http:");
  assert.equal(u.hostname, "127.0.0.1");
  assert.ok(u.port);
  assert.equal(u.pathname, "/");
  assert.equal(u.username + u.password + u.search + u.hash, "");
  return u.origin;
}
function redact(value, secrets = []) {
  let text = String(value);
  for (const secret of secrets.filter(Boolean))
    text = text.split(secret).join("[REDACTED]");
  return text.replace(
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    "[TOKEN]",
  );
}
function requiredReport(report) {
  assert.equal(report.status, "passed");
  assert.equal(report.tests.length, 8);
  assert.ok(report.tests.every((t) => t.status === "passed"));
}
module.exports = { loopbackOrigin, redact, requiredReport };
