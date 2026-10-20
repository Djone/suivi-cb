// Installed, reviewed validator only. The imported bundle contains data, never executable code.
const fs = require("node:fs"),
  path = require("node:path");
const {
  validate,
  assertQuality,
  checksumInventory,
} = require("../scripts/ci/contracts.cjs");
const { hash } = require("../scripts/ci/common.cjs");
function verifyApproval(m, approval) {
  validate(m, { qualified: true, registered: m.status === "PUBLISHED" });
  if (
    approval?.target !== "preproduction" ||
    !/^[1-9][0-9]*$/.test(String(m.runId)) ||
    !/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/.test(approval.approvedBy || "") ||
    !Number.isFinite(Date.parse(approval.approvedAt)) ||
    Date.parse(approval.approvedAt) > Date.now() ||
    approval.candidate !== m.candidate ||
    approval.commit !== m.commit ||
    approval.archiveSha256 !== m.archiveSha256 ||
    String(approval.runId) !== String(m.runId) ||
    approval.approved !== true
  )
    throw Error("NAS_APPROVAL_MISMATCH");
}
function verifyEnvironment(text) {
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const match =
      /^(KEYCLOAK_URL|KEYCLOAK_REALM|KEYCLOAK_CLIENT_ID|KEYCLOAK_AUDIENCE|DOCUMENTATION_DISABLED)=([^\r\n]*)$/.exec(
        line,
      );
    if (!match || Object.hasOwn(env, match[1]))
      throw Error("UNEXPECTED_PREPRODUCTION_ENVIRONMENT");
    env[match[1]] = match[2];
  }
  if (
    env.KEYCLOAK_URL !== "https://auth.jolurie.com" ||
    env.KEYCLOAK_REALM !== "suivi-cb-preprod" ||
    env.KEYCLOAK_CLIENT_ID !== "suivi-cb-web" ||
    env.KEYCLOAK_AUDIENCE !== "suivi-cb-api" ||
    (env.DOCUMENTATION_DISABLED && env.DOCUMENTATION_DISABLED !== "true")
  )
    throw Error("WRONG_PREPRODUCTION_REALM");
  return env;
}
async function bundle(dir, approval, environment) {
  const entries = checksumInventory(
    dir,
    fs.readFileSync(path.join(dir, "SHA256SUMS"), "utf8"),
  );
  for (const [file, digest] of entries)
    if ((await hash(path.join(dir, file))) !== digest)
      throw Error("BUNDLE_CHECKSUM_FAILED");
  const json = (file) =>
    JSON.parse(fs.readFileSync(path.join(dir, file + ".json"), "utf8"));
  const m = json("manifest");
  verifyApproval(m, approval);
  verifyEnvironment(environment);
  if ((await hash(path.join(dir, "images.tar"))) !== m.archiveSha256)
    throw Error("ARCHIVE_IDENTITY_FAILED");
  assertQuality(m, json("quality"));
  const e2e = json("e2e-qualification");
  if (
    e2e.status !== "PASS" ||
    e2e.cleanup.status !== "PASS" ||
    e2e.source.dirty !== false ||
    e2e.source.commit !== m.commit ||
    e2e.images?.[0]?.id !== m.images.backend.localId ||
    e2e.images?.[1]?.id !== m.images.frontend.localId
  )
    throw Error("E2E_PROOF_FAILED");
  const rollback = json("rollback");
  if (
    rollback.backend !== m.images.backend.localId ||
    rollback.frontend !== m.images.frontend.localId
  )
    throw Error("ROLLBACK_IDENTITY_FAILED");
  for (const key of ["rollback", "keycloak"])
    if (json(key).status !== "PASS") throw Error("EXECUTION_PROOF_FAILED");
  for (const key of ["source", "backend", "frontend"]) {
    const scan = json(key + "-scan");
    if (
      scan.status !== "PASS" ||
      scan.commit !== m.commit ||
      (key !== "source" && scan.configDigest !== m.images[key].configDigest)
    )
      throw Error("SCAN_PROOF_FAILED");
  }
  return m;
}
async function main() {
  const [dir, approvalFile, envFile] = process.argv.slice(2);
  if (
    dir !== "/bundle" ||
    approvalFile !== "/approval.json" ||
    envFile !== "/preprod.env"
  )
    throw Error("FIXED_CONTROL_PATHS_REQUIRED");
  const m = await bundle(
    dir,
    JSON.parse(fs.readFileSync(approvalFile, "utf8")),
    fs.readFileSync(envFile, "utf8"),
  );
  console.log(
    [
      m.candidate,
      m.commit,
      m.images.backend.localTag,
      m.images.backend.localId,
      m.images.backend.configDigest,
      m.images.frontend.localTag,
      m.images.frontend.localId,
      m.images.frontend.configDigest,
      m.runId,
    ].join("\n"),
  );
}
if (require.main === module)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
module.exports = { bundle, verifyApproval, verifyEnvironment };
