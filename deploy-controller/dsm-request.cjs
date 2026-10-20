const fs = require("node:fs");
const crypto = require("node:crypto");
const { verifyApproval } = require("./validate-bundle.cjs");
function readJson(file, max = 8192) {
  const s = fs.lstatSync(file);
  if (!s.isFile() || s.isSymbolicLink() || s.size > max)
    throw Error("UNSAFE_REQUEST_FILE");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function validateRequest(request, manifest, approval, now = Date.now()) {
  const fields = [
    "schema",
    "nonce",
    "action",
    "identity",
    "candidate",
    "commit",
    "archiveSha256",
    "requestedAt",
  ];
  if (
    !request ||
    Object.keys(request).length !== fields.length ||
    fields.some((k) => !Object.hasOwn(request, k)) ||
    request.schema !== 1 ||
    fields
      .filter((k) => k !== "schema")
      .some((k) => typeof request[k] !== "string") ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      request.nonce || "",
    ) ||
    !["plan", "apply-preproduction"].includes(request.action) ||
    !/^[a-f0-9]{64}$/.test(request.identity || "")
  )
    throw Error("INVALID_DSM_REQUEST");
  const at = Date.parse(request.requestedAt);
  if (!Number.isFinite(at) || at > now + 60000 || at < now - 15 * 60 * 1000)
    throw Error("DSM_REQUEST_EXPIRED");
  verifyApproval(manifest, approval);
  if (
    request.candidate !== manifest.candidate ||
    request.commit !== manifest.commit ||
    request.archiveSha256 !== manifest.archiveSha256
  )
    throw Error("DSM_CANDIDATE_MISMATCH");
  return request;
}
function main() {
  if (process.argv.length !== 2) throw Error("FIXED_PATHS_REQUIRED");
  const raw = fs.readFileSync("/control/incoming/manifest.json");
  const r = validateRequest(
    readJson("/requests/request.json"),
    JSON.parse(raw),
    readJson("/control/approval.json"),
  );
  console.log(
    [
      r.nonce,
      r.action,
      r.identity,
      r.candidate,
      r.commit,
      crypto.createHash("sha256").update(raw).digest("hex"),
      r.archiveSha256,
    ].join("\n"),
  );
}
if (require.main === module)
  try {
    main();
  } catch (e) {
    console.error(
      /^[A-Z_]+$/.test(e.message) ? e.message : "DSM_REQUEST_REJECTED",
    );
    process.exitCode = 1;
  }
module.exports = { validateRequest, readJson };
