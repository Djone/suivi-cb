const path = require("node:path");
const fs = require("node:fs");
const { ROOT, npm, exec, write, revision } = require("./common.cjs");
const checks = [];
const sourceDirtyAtStart = !!exec(
  "git",
  ["status", "--porcelain", "--untracked-files=all"],
  { capture: true },
);
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
    exec(
      process.execPath,
      [
        path.join(ROOT, "backend/node_modules/jest/bin/jest.js"),
        "--ci",
        "--coverage",
        "--maxWorkers=2",
        "--coverageReporters=json-summary",
        "--coverageReporters=text",
      ],
      { cwd: path.join(ROOT, "backend") },
    ),
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
  const coverageFile = path.join(
    ROOT,
    "backend/coverage/coverage-summary.json",
  );
  if (fs.existsSync(coverageFile))
    write(path.join(ROOT, ".cache/ci/quality/backend-coverage.json"), {
      commit: revision(),
      runId: process.env.GITHUB_RUN_ID || "local",
      totals: JSON.parse(fs.readFileSync(coverageFile)).total,
      threshold: 70,
    });
  const status =
    checks.length === 10 && checks.every((c) => c.status === "PASS")
      ? "PASS"
      : "FAIL";
  write(path.join(ROOT, ".cache/ci/quality/quality.json"), {
    schema: 1,
    sourceDirty:
      sourceDirtyAtStart ||
      !!exec("git", ["status", "--porcelain", "--untracked-files=all"], {
        capture: true,
      }),
    commit: revision(),
    runId: process.env.GITHUB_RUN_ID || "local",
    status,
    checks,
  });
  if (status !== "PASS") process.exitCode = 1;
}
