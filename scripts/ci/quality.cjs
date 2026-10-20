const path = require("node:path");
const { ROOT, npm, exec, write, revision } = require("./common.cjs");
const checks = [];
function check(name, run) {
  try {
    run();
    checks.push({ name, status: "PASS" });
  } catch (e) {
    checks.push({ name, status: "FAIL", reason: e.message });
    console.error(name + ": " + e.message);
  }
}
try {
  for (const name of [
    "lint",
    "typecheck",
    "test:ci:policy",
    "test:candidate",
    "test:e2e:safety",
  ])
    check(name, () => npm(["run", name]));
  check("backend-unit-coverage", () =>
    npm(["run", "test:ci"], { cwd: path.join(ROOT, "backend") }),
  );
  // Execute security checks even if the existing coverage gate fails first.
  for (const name of ["test:auth", "test:security"])
    check("backend-" + name, () =>
      npm(["run", name], { cwd: path.join(ROOT, "backend") }),
    );
  check("frontend-unit", () =>
    npm(["run", "test:ci"], { cwd: path.join(ROOT, "frontend") }),
  );
  check("dependency-gates", () =>
    exec(process.execPath, ["scripts/ci/dependencies.cjs"]),
  );
} finally {
  const status =
    checks.length === 10 && checks.every((c) => c.status === "PASS")
      ? "PASS"
      : "FAIL";
  write(path.join(ROOT, ".cache/ci/quality/quality.json"), {
    schema: 1,
    commit: revision(),
    runId: process.env.GITHUB_RUN_ID || "local",
    status,
    checks,
  });
  if (status !== "PASS") process.exitCode = 1;
}
