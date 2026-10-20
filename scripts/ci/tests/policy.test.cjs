const { test } = require("node:test");
const assert = require("node:assert/strict");
const { gate } = require("../dependencies.cjs");
const { candidate, registryRef } = require("../common.cjs");
const { summarize } = require("../scan.cjs");
const policy = {
  accepted: true,
  productionDeploymentApproved: false,
  advisory: "GHSA-vfj7-8cjw-p6xm",
  component: "braces@3.0.3",
  reviewBy: "2026-10-22",
};
const report = {
  metadata: { vulnerabilities: { high: 2, total: 2 } },
  vulnerabilities: {
    braces: {
      via: [
        {
          name: "braces",
          url: "https://github.com/advisories/" + policy.advisory,
        },
      ],
    },
    transitive: { via: ["braces"] },
  },
};
const options = {
  module: "frontend",
  scope: "development",
  policy,
  lock: { packages: { "node_modules/braces": { version: "3.0.3" } } },
  now: new Date("2026-10-20T00:00:00Z"),
};
test("only the precise accepted development alert and its dependants pass", () => {
  assert.equal(gate(report, options).status, "PASS");
  assert.equal(
    gate(report, { ...options, scope: "production" }).status,
    "FAIL",
  );
  assert.equal(gate(report, { ...options, module: "backend" }).status, "FAIL");
});
test("expired exceptions fail closed without automatic extension", () =>
  assert.throws(
    () => gate(report, { ...options, now: new Date("2026-10-23T00:00:00Z") }),
    /EXCEPTION/,
  ));
test("unknown advisories, different installed versions and cycles are blocked", () => {
  const r = structuredClone(report);
  r.vulnerabilities.braces.via[0].url = "https://github.com/advisories/OTHER";
  assert.equal(gate(r, options).status, "FAIL");
  assert.equal(
    gate(report, {
      ...options,
      lock: { packages: { "node_modules/braces": { version: "3.0.2" } } },
    }).status,
    "FAIL",
  );
  r.vulnerabilities.braces.via = ["transitive"];
  assert.equal(gate(r, options).status, "FAIL");
});
test("audit execution errors cannot become successful reports", () =>
  assert.throws(() => gate({ error: {} }, options), /AUDIT_UNREADABLE/));
test("candidate and registry values cannot inject shell commands or foreign images", () => {
  assert.equal(candidate("2.2.0-rc.9"), "2.2.0-rc.9");
  for (const v of ["latest", "2.3.0", "2.2.0-rc.9;id"])
    assert.throws(() => candidate(v));
  assert.equal(
    registryRef(
      "ghcr.io/djone/suivi-cb-backend@sha256:" + "a".repeat(64),
      "backend",
    ).length > 64,
    true,
  );
  assert.throws(() =>
    registryRef("ghcr.io/other/backend@sha256:" + "a".repeat(64), "backend"),
  );
});
test("secret scan reports retain locations without leaking matched secret values", () => {
  const result = summarize({
    SchemaVersion: 2,
    Results: [
      {
        Target: "file",
        Secrets: [
          {
            RuleID: "token",
            Severity: "HIGH",
            Match: "PRIVATE_TOKEN_VALUE",
            Code: { Lines: ["PRIVATE_TOKEN_VALUE"] },
            StartLine: 1,
            EndLine: 1,
          },
        ],
      },
    ],
  });
  assert.equal(result.status, "FAIL");
  assert.ok(!JSON.stringify(result).includes("PRIVATE_TOKEN_VALUE"));
  assert.equal(summarize({ SchemaVersion: 2, Results: [] }).status, "PASS");
});
const { validate, deploymentPlan } = require("../contracts.cjs");
function fixture() {
  return {
    schema: 2,
    exceptionReviewBy: "2099-01-01",
    status: "QUALIFIED",
    candidate: "2.2.0-rc.9",
    commit: "a".repeat(40),
    archiveSha256: "b".repeat(64),
    platform: "linux/amd64",
    runId: "123",
    images: Object.fromEntries(
      ["backend", "frontend"].map((s) => [
        s,
        {
          architecture: "amd64",
          user: s === "backend" ? "1028:100" : "nginx",
          localTag: "suivi-cb-ci-" + s + ":2.2.0-rc.9",
          localId: "sha256:" + "c".repeat(64),
          configDigest: "sha256:" + "d".repeat(64),
          registryRef:
            "ghcr.io/djone/suivi-cb-" + s + "@sha256:" + "e".repeat(64),
        },
      ]),
    ),
  };
}
test("qualification requires exact source, run and non-root image identities", () => {
  const m = fixture();
  validate(m, { qualified: true, commit: m.commit, runId: "123" });
  assert.throws(() => validate(m, { commit: "f".repeat(40) }));
  assert.throws(() => validate({ ...m, status: "BUILT" }, { qualified: true }));
  const bad = structuredClone(m);
  bad.images.backend.user = "root";
  assert.throws(() => validate(bad));
});
test("production plan retains current database and promotes only qualified exact digests", () => {
  const p = deploymentPlan(fixture(), "production");
  assert.equal(p.rebuild, false);
  assert.equal(p.automaticDatabaseRestore, false);
  assert.equal(p.requiresHumanApproval, true);
  assert.ok(
    p.steps.findIndex((s) => s.startsWith("coherent SQLite")) <
      p.steps.findIndex((s) => s.startsWith("promote")),
  );
  assert.throws(() =>
    deploymentPlan({ ...fixture(), status: "BUILT" }, "production"),
  );
  assert.throws(() => deploymentPlan(fixture(), "other"));
});
test("public workflows never expose secrets or NAS runner to PR code", () => {
  const fs = require("node:fs"),
    path = require("node:path");
  const yaml = require("../../../backend/node_modules/yaml");
  const workflow = yaml.parse(
    fs.readFileSync(
      path.join(__dirname, "../../../.github/workflows/ci.yml"),
      "utf8",
    ),
  );
  assert.equal(workflow.permissions.contents, "read");
  assert.ok(!workflow.on.pull_request_target);
  for (const job of Object.values(workflow.jobs)) {
    assert.equal(job["runs-on"], "ubuntu-24.04");
    for (const step of job.steps || [])
      if (step.uses) assert.match(step.uses, /^actions\/[a-z-]+@[a-f0-9]{40}$/);
  }
  assert.equal(workflow.jobs.publish.environment, "candidate-registry");
  assert.ok(
    workflow.jobs.publish.if.includes(
      "github.event_name == 'workflow_dispatch'",
    ),
  );
  assert.equal(workflow.jobs.publish.permissions.packages, "write");
  for (const name of ["quality", "integration", "required"])
    assert.ok(!workflow.jobs[name].permissions?.packages);
});
test("invalid scan output fails closed", () =>
  assert.throws(() => summarize({}), /INVALID_SCAN/));
test("checksum inventory refuses unlisted files and duplicate entries", () => {
  const fs = require("node:fs"),
    os = require("node:os"),
    path = require("node:path");
  const { checksumInventory } = require("../contracts.cjs");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "suivi-inventory-"));
  try {
    const names = ["manifest.json", "images.tar", "inspection.json"];
    for (const n of names) fs.writeFileSync(path.join(dir, n), "test");
    const lines = names.map((n) => "a".repeat(64) + "  " + n).join("\n");
    assert.equal(checksumInventory(dir, lines).size, 3);
    fs.writeFileSync(path.join(dir, "unlisted.json"), "unlisted");
    assert.throws(() => checksumInventory(dir, lines), /INCOMPLETE/);
    assert.throws(
      () => checksumInventory(dir, lines + "\n" + lines),
      /INVENTORY/,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("an expired or missing exception deadline blocks promotion even after qualification", () => {
  assert.throws(
    () =>
      validate(
        { ...fixture(), exceptionReviewBy: "2000-01-01" },
        { qualified: true },
      ),
    /EXCEPTION/,
  );
  assert.throws(
    () =>
      deploymentPlan(
        { ...fixture(), exceptionReviewBy: undefined },
        "production",
      ),
    /EXCEPTION/,
  );
});
test("dirty, failed or foreign quality reports cannot qualify a candidate", () => {
  const { assertQuality } = require("../contracts.cjs");
  const m = fixture(),
    q = {
      status: "PASS",
      sourceDirty: false,
      commit: m.commit,
      runId: m.runId,
    };
  assert.doesNotThrow(() => assertQuality(m, q));
  for (const change of [
    { status: "FAIL" },
    { sourceDirty: true },
    { sourceDirty: undefined },
    { commit: "f".repeat(40) },
    { runId: "999" },
  ])
    assert.throws(() => assertQuality(m, { ...q, ...change }), /QUALITY/);
});
test("publication refuses missing reviewers, self-approval, administrator bypass and untrusted triggers", async () => {
  const { environmentGuard } = require("../publish.cjs");
  const keys = ["GITHUB_REF", "GITHUB_EVENT_NAME", "GITHUB_REPOSITORY"];
  const old = Object.fromEntries(keys.map((k) => [k, process.env[k]])),
    fetchBefore = global.fetch;
  try {
    Object.assign(process.env, {
      GITHUB_REF: "refs/heads/2.2.0-dev",
      GITHUB_EVENT_NAME: "workflow_dispatch",
      GITHUB_REPOSITORY: "Djone/suivi-cb",
    });
    let env = {
      protection_rules: [
        {
          type: "required_reviewers",
          reviewers: [{ id: 1 }],
          prevent_self_review: true,
        },
      ],
      deployment_branch_policy: { protected_branches: true },
      can_admins_bypass: false,
    };
    global.fetch = async () => ({ ok: true, json: async () => env });
    await assert.doesNotReject(() => environmentGuard("synthetic-token"));
    env.can_admins_bypass = true;
    await assert.rejects(() => environmentGuard("synthetic-token"));
    env.can_admins_bypass = false;
    env.protection_rules[0].prevent_self_review = false;
    await assert.rejects(() => environmentGuard("synthetic-token"));
    env.protection_rules[0].prevent_self_review = true;
    env.protection_rules[0].reviewers = [];
    await assert.rejects(() => environmentGuard("synthetic-token"));
    process.env.GITHUB_EVENT_NAME = "pull_request";
    await assert.rejects(
      () => environmentGuard("synthetic-token"),
      /UNTRUSTED/,
    );
  } finally {
    global.fetch = fetchBefore;
    for (const key of keys)
      if (old[key] === undefined) delete process.env[key];
      else process.env[key] = old[key];
  }
});
