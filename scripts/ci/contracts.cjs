const fs = require("node:fs"),
  path = require("node:path");
const { candidate, registryRef } = require("./common.cjs");
const SHA = /^sha256:[a-f0-9]{64}$/;
function validate(
  m,
  { qualified = false, registered = false, commit, runId } = {},
) {
  if (
    m?.schema !== 2 ||
    !["BUILT", "QUALIFIED", "PUBLISHED"].includes(m.status) ||
    m.platform !== "linux/amd64" ||
    !/^[a-f0-9]{40}$/.test(m.commit || "") ||
    !/^[a-f0-9]{64}$/.test(m.archiveSha256 || "")
  )
    throw Error("INVALID_MANIFEST");
  candidate(m.candidate);
  if (qualified && !["QUALIFIED", "PUBLISHED"].includes(m.status))
    throw Error("UNQUALIFIED_CANDIDATE");
  if (
    (commit && m.commit !== commit) ||
    (runId && String(m.runId) !== String(runId))
  )
    throw Error("SOURCE_RUN_MISMATCH");
  if (qualified) {
    const deadline = Date.parse(m.exceptionReviewBy + "T23:59:59.999Z");
    if (!Number.isFinite(deadline) || Date.now() > deadline)
      throw Error("EXCEPTION_EXPIRED_OR_INVALID");
  }
  if (
    Object.keys(m.images || {})
      .sort()
      .join(",") !== "backend,frontend"
  )
    throw Error("INVALID_IMAGES");
  for (const service of ["backend", "frontend"]) {
    const i = m.images[service];
    if (
      i.architecture !== "amd64" ||
      !SHA.test(i.localId) ||
      !SHA.test(i.configDigest) ||
      i.localTag !== "suivi-cb-ci-" + service + ":" + m.candidate ||
      !["1028:100", "nginx"].includes(i.user) ||
      i.user !== (service === "backend" ? "1028:100" : "nginx")
    )
      throw Error("INVALID_IMAGE_IDENTITY");
    if (registered) registryRef(i.registryRef, service);
  }
  return m;
}
function deploymentPlan(m, target) {
  validate(m, { qualified: true, registered: true });
  if (!["preproduction", "production"].includes(target))
    throw Error("INVALID_TARGET");
  return {
    schema: 1,
    target,
    candidate: m.candidate,
    commit: m.commit,
    images: Object.fromEntries(
      Object.entries(m.images).map(([service, i]) => [
        service,
        { reference: i.registryRef, configDigest: i.configDigest },
      ]),
    ),
    requiresHumanApproval: true,
    requiresNasAcceptance: true,
    steps:
      target === "production"
        ? [
            "verify approval and preproduction receipt for exact digests",
            "verify compatible rollback image digests",
            "coherent SQLite backup and checksum; abort on failure",
            "pull exact digests and verify architecture/config identities",
            "promote application services only; never restart Keycloak",
            "health, version, anonymous 401 and authorized smoke tests",
            "on failure revert application images only; retain current database",
            "persist deployment receipt",
          ]
        : [
            "verify isolated synthetic data directory and realm",
            "pull exact digests and verify architecture/config identities",
            "deploy application services without build",
            "health, version, 401/403/200 and business acceptance",
            "persist receipt with digests; no production approval implied",
          ],
    automaticDatabaseRestore: false,
    rebuild: false,
  };
}
function checksumInventory(dir, lines) {
  const parsed = new Map();
  for (const line of lines.trim().split(/\r?\n/)) {
    const match = /^([a-f0-9]{64})  ([a-zA-Z0-9][a-zA-Z0-9._-]*)$/.exec(line);
    if (!match || match[2] === "SHA256SUMS" || parsed.has(match[2]))
      throw Error("INVALID_CHECKSUM_INVENTORY");
    const p = path.join(dir, match[2]);
    if (!fs.lstatSync(p).isFile() || fs.lstatSync(p).isSymbolicLink())
      throw Error("INVALID_PACKAGE_FILE");
    parsed.set(match[2], match[1]);
  }
  const actual = fs
    .readdirSync(dir)
    .filter((n) => n !== "SHA256SUMS")
    .sort();
  if (
    actual.join(",") !== [...parsed.keys()].sort().join(",") ||
    !parsed.has("manifest.json") ||
    !parsed.has("images.tar") ||
    !parsed.has("inspection.json")
  )
    throw Error("INCOMPLETE_PACKAGE");
  return parsed;
}
module.exports = { validate, deploymentPlan, checksumInventory };
