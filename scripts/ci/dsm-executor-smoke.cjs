const fs = require("node:fs"),
  path = require("node:path");
const { execFileSync } = require("node:child_process");
const { createDsmKit } = require("../../backend/services/release-dsm-kit");
const root = path.resolve(__dirname, "../..");
const kit = createDsmKit({ root })();
const smoke = fs.mkdtempSync(path.join(root, ".cache/ci/dsm-smoke-"));
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
for (const [file, value] of [
  ["manifest.json", m],
  ["approval.json", approval],
])
  fs.writeFileSync(path.join(smoke, file), JSON.stringify(value));
const initial =
  fs
    .readFileSync(
      path.join(root, "deploy-controller/guide/install-release-ssh.sh"),
      "utf8",
    )
    .match(/<<'ENTRY'\r?\n([\s\S]*?)\r?\nENTRY/)[1]
    .replace(/\r\n/g, "\n") + "\n";
fs.writeFileSync(path.join(smoke, "initial-entry.sh"), initial);
fs.copyFileSync(
  path.join(__dirname, "tests/dsm-executor-smoke.sh"),
  path.join(smoke, "run.sh"),
);
fs.writeFileSync(
  path.join(smoke, "request.cjs"),
  `const fs=require('fs');const m=JSON.parse(fs.readFileSync('/smoke/manifest.json'));const r={schema:1,nonce:process.env.NONCE,action:process.env.ACTION,identity:'e'.repeat(64),candidate:m.candidate,commit:m.commit,archiveSha256:m.archiveSha256,requestedAt:new Date().toISOString()};if(process.env.VARIANT==='foreign')r.commit='f'.repeat(40);if(process.env.VARIANT==='expired')r.requestedAt=new Date(Date.now()-3600000).toISOString();if(process.env.VARIANT==='production')r.action='production';console.log(JSON.stringify(r));`,
);
execFileSync(
  "docker",
  [
    "run",
    "--rm",
    "--network",
    "none",
    "--memory",
    "256m",
    "--pids-limit",
    "128",
    "--user",
    "0:0",
    "--mount",
    `type=bind,source=${kit.directory},target=/kit,readonly`,
    "--mount",
    `type=bind,source=${smoke},target=/smoke,readonly`,
    "--entrypoint",
    "sh",
    "node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1",
    "/smoke/run.sh",
  ],
  { cwd: root, stdio: "inherit", timeout: 120000 },
);
