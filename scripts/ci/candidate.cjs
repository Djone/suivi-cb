const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const { ROOT, exec, hash, write, clean, candidate } = require("./common.cjs");
const DIR = path.join(ROOT, ".cache/ci/package");
function docker(args, capture = true) {
  return exec("docker", args, { capture });
}
function manifest() {
  return JSON.parse(fs.readFileSync(path.join(DIR, "manifest.json")));
}
async function checksums() {
  const names = fs
    .readdirSync(DIR)
    .filter(
      (n) => n !== "SHA256SUMS" && fs.statSync(path.join(DIR, n)).isFile(),
    )
    .sort();
  const lines = [];
  for (const n of names) lines.push((await hash(path.join(DIR, n))) + "  " + n);
  fs.writeFileSync(path.join(DIR, "SHA256SUMS"), lines.join("\n") + "\n");
}
async function verify() {
  const { validate, checksumInventory } = require("./contracts.cjs");
  const entries = checksumInventory(
    DIR,
    fs.readFileSync(path.join(DIR, "SHA256SUMS"), "utf8"),
  );
  for (const [name, digest] of entries)
    if ((await hash(path.join(DIR, name))) !== digest)
      throw Error("PACKAGE_CHECKSUM_FAILED");
  const m = validate(manifest());
  if ((await hash(path.join(DIR, "images.tar"))) !== m.archiveSha256)
    throw Error("ARCHIVE_IDENTITY_FAILED");
  return m;
}
async function build() {
  const version = candidate(process.env.CANDIDATE);
  const commit = clean();
  fs.mkdirSync(path.dirname(DIR), { recursive: true });
  fs.mkdirSync(DIR, { recursive: false });
  const images = {};
  const builtAt = new Date().toISOString();
  for (const service of ["backend", "frontend"]) {
    const tag = "suivi-cb-ci-" + service + ":" + version;
    try {
      docker(["image", "inspect", tag]);
      throw Error("IMAGE_TAG_ALREADY_RESERVED");
    } catch (e) {
      if (e.message === "IMAGE_TAG_ALREADY_RESERVED") throw e;
    }
    docker(
      [
        "build",
        "--platform",
        "linux/amd64",
        "--label",
        "org.opencontainers.image.revision=" + commit,
        "--label",
        "org.opencontainers.image.version=" + version,
        "--label",
        "org.opencontainers.image.source=https://github.com/Djone/suivi-cb",
        ...(service === "frontend"
          ? [
              "--build-arg",
              "APP_VERSION=" + version,
              "--build-arg",
              "APP_BUILD_TIME=" + builtAt,
            ]
          : []),
        "-f",
        "Dockerfile." + service,
        "-t",
        tag,
        ".",
      ],
      false,
    );
    const row = JSON.parse(docker(["image", "inspect", tag]))[0];
    if (
      row.Architecture !== "amd64" ||
      row.Os !== "linux" ||
      !row.Config.User ||
      ["0", "root", "0:0"].includes(row.Config.User)
    )
      throw Error("IMAGE_RUNTIME_IDENTITY_FAILED");
    images[service] = {
      localTag: tag,
      localId: row.Id,
      user: row.Config.User,
      architecture: row.Architecture,
    };
  }
  if (clean() !== commit) throw Error("SOURCES_CHANGED_DURING_BUILD");
  docker([
    "save",
    "-o",
    path.join(DIR, "images.tar"),
    ...Object.values(images).map((i) => i.localTag),
  ]);
  exec(process.execPath, [
    "scripts/audit-image-archive.mjs",
    path.join(DIR, "images.tar"),
    path.join(DIR, "inspection.json"),
  ]);
  const inspection = JSON.parse(
    fs.readFileSync(path.join(DIR, "inspection.json")),
  );
  if (inspection.images.length !== 2) throw Error("ARCHIVE_IMAGE_COUNT");
  for (const service of ["backend", "frontend"]) {
    const item = inspection.images.find((i) =>
      i.tags.includes(images[service].localTag),
    );
    if (
      !item ||
      item.sensitivePaths.length ||
      item.sourceDifferences.length ||
      (service === "frontend" &&
        (!item.nginx.matchesWorkspace || !item.nginx.silentSsoException))
    )
      throw Error("ARCHIVE_INSPECTION_FAILED");
    images[service].configDigest = item.configDigest;
  }
  write(path.join(DIR, "manifest.json"), {
    schema: 2,
    candidate: version,
    commit,
    platform: "linux/amd64",
    status: "BUILT",
    createdAt: builtAt,
    runId: process.env.GITHUB_RUN_ID || "local",
    images,
    archiveSha256: await hash(path.join(DIR, "images.tar")),
  });
  await checksums();
  console.log("Candidate built exactly once: " + version);
}
function removeTemp(tmp) {
  if (
    path.dirname(path.resolve(tmp)) !== path.resolve(os.tmpdir()) ||
    !path.basename(tmp).startsWith("suivi-legacy-")
  )
    throw Error("TEMP_PATH_FAILED");
  fs.rmSync(tmp, { recursive: true, force: true });
}
async function legacy(base) {
  const sha = "2ca4713d9142bde459b45dae9580059f53f70a3a";
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "suivi-legacy-"));
  const name = "suivi-legacy-" + Date.now();
  let created = false;
  try {
    exec("git", [
      "archive",
      "--format=tar",
      "--output=" + path.join(tmp, "source.tar"),
      sha,
      "backend",
    ]);
    exec("tar", ["-xf", path.join(tmp, "source.tar"), "-C", tmp]);
    function prune(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (entry.isSymbolicLink()) fs.unlinkSync(file);
        else if (entry.isDirectory()) prune(file);
        else if (!/\.(js|json)$/.test(entry.name)) fs.unlinkSync(file);
      }
    }
    prune(path.join(tmp, "backend"));
    docker(["create", "--name", name, "--network", "none", base]);
    created = true;
    docker(["cp", path.join(tmp, "backend") + path.sep + ".", name + ":/app"]);
    docker([
      "commit",
      "--change",
      "LABEL org.opencontainers.image.revision=" + sha,
      "--change",
      "LABEL io.suivi.test-only=legacy-source-current-runtime",
      name,
      name,
    ]);
    return {
      name,
      sourceCommit: sha,
      kind: "legacy source compatibility fixture; candidate runtime/dependencies, not the exact NAS image",
    };
  } finally {
    if (created) docker(["rm", name]);
    removeTemp(tmp);
  }
}
async function exercise() {
  const m = await verify();
  const args = Object.values(m.images).map((i) => i.localTag);
  const out = exec(
    process.execPath,
    [
      "scripts/test-e2e.cjs",
      "--backend-image=" + args[0],
      "--frontend-image=" + args[1],
    ],
    { capture: true },
  );
  console.log(out);
  const reportPath = out.match(/Report: (.+)/)?.[1].trim();
  if (
    !reportPath ||
    !path
      .resolve(reportPath)
      .startsWith(path.join(ROOT, ".cache/e2e") + path.sep)
  )
    throw Error("E2E_REPORT_PATH");
  const q = JSON.parse(
    fs.readFileSync(path.join(reportPath, "qualification.json")),
  );
  if (
    q.status !== "PASS" ||
    q.cleanup.status !== "PASS" ||
    q.source.commit !== m.commit ||
    q.source.dirty !== false ||
    q.images[0].id !== m.images.backend.localId ||
    q.images[1].id !== m.images.frontend.localId
  )
    throw Error("E2E_IDENTITY_MISMATCH");
  fs.copyFileSync(
    path.join(reportPath, "qualification.json"),
    path.join(DIR, "e2e-qualification.json"),
  );
  fs.copyFileSync(
    path.join(reportPath, "tests.json"),
    path.join(DIR, "e2e-tests.json"),
  );
  const ref = await legacy(args[0]);
  const rollback = JSON.parse(
    exec(
      process.execPath,
      ["scripts/test-security-images.cjs", ...args, ref.name],
      { capture: true },
    ),
  );
  if (rollback.status !== "PASS") throw Error("ROLLBACK_FAILED");
  write(path.join(DIR, "rollback.json"), { ...rollback, reference: ref });
  const kc = JSON.parse(
    exec(process.execPath, ["scripts/test-keycloak-flow.cjs"], {
      capture: true,
    }),
  );
  if (kc.status !== "PASS") throw Error("KEYCLOAK_FAILED");
  write(path.join(DIR, "keycloak.json"), kc);
  await checksums();
}
async function qualify() {
  const m = await verify();
  for (const name of [
    "e2e-qualification.json",
    "rollback.json",
    "keycloak.json",
  ])
    if (JSON.parse(fs.readFileSync(path.join(DIR, name))).status !== "PASS")
      throw Error("MISSING_EXECUTION_PROOF");
  for (const name of ["source", "backend", "frontend"]) {
    const s = JSON.parse(fs.readFileSync(path.join(DIR, name + "-scan.json")));
    if (
      s.status !== "PASS" ||
      s.commit !== m.commit ||
      (name !== "source" && s.configDigest !== m.images[name].configDigest)
    )
      throw Error("MISSING_SCAN_PROOF");
  }
  const quality = JSON.parse(fs.readFileSync(path.join(DIR, "quality.json")));
  if (
    quality.status !== "PASS" ||
    quality.commit !== m.commit ||
    String(quality.runId) !== String(m.runId)
  )
    throw Error("QUALITY_SOURCE_MISMATCH");
  m.status = "QUALIFIED";
  write(path.join(DIR, "manifest.json"), m);
  await checksums();
}
async function main() {
  const cmd = process.argv[2];
  if (cmd === "build") await build();
  else if (cmd === "exercise") await exercise();
  else if (cmd === "qualify") await qualify();
  else if (cmd === "verify") await verify();
  else if (cmd === "image") {
    const service = process.argv[3];
    if (!["backend", "frontend"].includes(service))
      throw Error("INVALID_SERVICE");
    console.log(manifest().images[service].localTag);
  } else throw Error("INVALID_COMMAND");
}
if (require.main === module)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
module.exports = { DIR, manifest, verify, checksums, docker, legacy };
