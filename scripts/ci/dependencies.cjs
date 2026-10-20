const fs = require("node:fs"),
  path = require("node:path"),
  { spawnSync } = require("node:child_process");
const { ROOT, write } = require("./common.cjs");
const POLICY = path.join(
  ROOT,
  "docs/audit/2026-10-15/dependency-risk-acceptance.json",
);
function gate(report, { module, scope, lock, policy, now = new Date() }) {
  if (report.error || !report.metadata || !report.vulnerabilities)
    throw Error("AUDIT_UNREADABLE");
  const deadline = Date.parse(policy.reviewBy + "T23:59:59.999Z");
  if (
    !policy.accepted ||
    policy.productionDeploymentApproved !== false ||
    !Number.isFinite(deadline) ||
    now.getTime() > deadline
  )
    throw Error("EXCEPTION_EXPIRED_OR_INVALID");
  const versions = Object.entries(lock.packages || {})
    .filter(([p]) => p.endsWith("node_modules/braces"))
    .map(([, p]) => p.version);
  const visiting = new Set();
  function allowed(name) {
    if (visiting.has(name)) return false;
    visiting.add(name);
    const v = report.vulnerabilities[name];
    const ok =
      !!v &&
      v.via.length > 0 &&
      v.via.every((a) =>
        typeof a === "string"
          ? allowed(a)
          : module === "frontend" &&
            scope === "development" &&
            a.url === "https://github.com/advisories/" + policy.advisory &&
            policy.component === "braces@3.0.3" &&
            versions.length > 0 &&
            versions.every((x) => x === "3.0.3"),
      );
    visiting.delete(name);
    return ok;
  }
  const blocked = [],
    accepted = [];
  for (const name of Object.keys(report.vulnerabilities))
    (allowed(name) ? accepted : blocked).push(name);
  return {
    module,
    scope,
    status: blocked.length ? "FAIL" : "PASS",
    blocked,
    accepted,
    exceptionReviewBy: policy.reviewBy,
    counts: report.metadata.vulnerabilities,
  };
}
async function main() {
  const policy = JSON.parse(fs.readFileSync(POLICY));
  const results = [];
  for (const module of ["root", "backend", "frontend"])
    for (const scope of ["production", "development"]) {
      const cwd = module === "root" ? ROOT : path.join(ROOT, module);
      const args = [
        "audit",
        "--json",
        ...(scope === "production" ? ["--omit=dev"] : []),
      ];
      const r =
        process.platform === "win32"
          ? spawnSync(
              process.env.ComSpec,
              ["/d", "/s", "/c", "npm " + args.join(" ")],
              { cwd, encoding: "utf8" },
            )
          : spawnSync("npm", args, { cwd, encoding: "utf8" });
      if (![0, 1].includes(r.status)) throw Error("AUDIT_EXECUTION_FAILED");
      const report = JSON.parse(r.stdout);
      const lock = JSON.parse(
        fs.readFileSync(path.join(cwd, "package-lock.json")),
      );
      results.push(gate(report, { module, scope, lock, policy }));
    }
  write(path.join(ROOT, ".cache/ci/quality/dependencies.json"), {
    checkedAt: new Date().toISOString(),
    results,
  });
  if (results.some((r) => r.status !== "PASS"))
    throw Error("UNACCEPTED_DEPENDENCY_ALERT");
  console.log(
    "Dependency gates PASS; braces review deadline " + policy.reviewBy,
  );
}
if (require.main === module)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
module.exports = { gate };
