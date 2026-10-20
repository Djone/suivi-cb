const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const { spawnSync } = require("node:child_process");
const { ROOT, exec, write, revision } = require("./common.cjs");
const { DIR, verify, checksums, docker } = require("./candidate.cjs");
const { validate } = require("./contracts.cjs");
async function environmentGuard(token) {
  const ref = process.env.GITHUB_REF;
  if (
    !["refs/heads/master", "refs/heads/2.2.0-dev"].includes(ref) ||
    process.env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
    process.env.GITHUB_REPOSITORY !== "Djone/suivi-cb"
  )
    throw Error("UNTRUSTED_PUBLICATION_CONTEXT");
  const r = await fetch(
    "https://api.github.com/repos/Djone/suivi-cb/environments/candidate-registry",
    {
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
      },
    },
  );
  if (!r.ok) throw Error("ENVIRONMENT_UNVERIFIABLE");
  const env = await r.json();
  if (
    !env.protection_rules?.some(
      (rule) =>
        rule.type === "required_reviewers" &&
        rule.reviewers?.length &&
        (rule.prevent_self_review === true ||
          (rule.prevent_self_review === false &&
            rule.reviewers.every(
              (x) => x.type === "User" && x.reviewer?.login === "Djone",
            ))),
    ) ||
    !env.deployment_branch_policy?.protected_branches ||
    env.can_admins_bypass !== false
  )
    throw Error("ENVIRONMENT_APPROVAL_AND_PROTECTED_BRANCHES_REQUIRED");
}
function cli(args, options = {}) {
  const result = spawnSync("docker", args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 4000000,
    ...options,
  });
  if (result.status !== 0) throw Error("REGISTRY_OPERATION_FAILED");
  return result.stdout;
}
async function tagAbsent(tag, token) {
  const repository = tag.slice("ghcr.io/".length, tag.lastIndexOf(":")),
    version = tag.slice(tag.lastIndexOf(":") + 1);
  const basic = Buffer.from(process.env.GITHUB_ACTOR + ":" + token).toString(
    "base64",
  );
  const auth = await fetch(
    "https://ghcr.io/token?service=ghcr.io&scope=" +
      encodeURIComponent("repository:" + repository + ":pull"),
    { headers: { Authorization: "Basic " + basic } },
  );
  if (!auth.ok) throw Error("REGISTRY_TAG_EXISTENCE_UNVERIFIABLE");
  const bearer = (await auth.json()).token;
  if (!bearer) throw Error("REGISTRY_TOKEN_INVALID");
  const response = await fetch(
    "https://ghcr.io/v2/" + repository + "/manifests/" + version,
    {
      method: "HEAD",
      headers: {
        Authorization: "Bearer " + bearer,
        Accept:
          "application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json",
      },
    },
  );
  if (response.status !== 404)
    throw Error(
      response.ok
        ? "CANDIDATE_TAG_ALREADY_EXISTS"
        : "REGISTRY_TAG_EXISTENCE_UNVERIFIABLE",
    );
}
async function main() {
  const token = process.env.GHCR_TOKEN;
  if (!token) throw Error("REGISTRY_TOKEN_REQUIRED");
  await environmentGuard(token);
  const exception = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, "docs/audit/2026-10-15/dependency-risk-acceptance.json"),
    ),
  );
  if (
    !Number.isFinite(Date.parse(exception.reviewBy + "T23:59:59.999Z")) ||
    Date.now() > Date.parse(exception.reviewBy + "T23:59:59.999Z")
  )
    throw Error("EXCEPTION_EXPIRED_OR_INVALID");
  const m = validate(await verify(), {
    qualified: true,
    commit: revision(),
    runId: process.env.GITHUB_RUN_ID,
  });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "suivi-registry-"));
  const old = process.env.DOCKER_CONFIG;
  process.env.DOCKER_CONFIG = tmp;
  try {
    cli(
      [
        "login",
        "ghcr.io",
        "--username",
        process.env.GITHUB_ACTOR,
        "--password-stdin",
      ],
      { input: token, stdio: ["pipe", "pipe", "pipe"] },
    );
    const tags = Object.fromEntries(
      ["backend", "frontend"].map((service) => [
        service,
        "ghcr.io/djone/suivi-cb-" + service + ":" + m.candidate,
      ]),
    );
    for (const tag of Object.values(tags)) await tagAbsent(tag, token);
    docker(["load", "-i", path.join(DIR, "images.tar")]);
    for (const service of ["backend", "frontend"]) {
      const image = m.images[service];
      const local = JSON.parse(docker(["image", "inspect", image.localTag]))[0];
      if (local.Id !== image.localId) throw Error("IMPORTED_IMAGE_CHANGED");
      docker(["tag", image.localTag, tags[service]]);
      const output = cli(["push", tags[service]]);
      const digest = output.match(/digest: (sha256:[a-f0-9]{64})/)?.[1];
      if (!digest) throw Error("PUSH_DIGEST_MISSING");
      image.registryRef = tags[service].split(":")[0] + "@" + digest;
      docker(["pull", image.registryRef]);
      const actual = JSON.parse(
        docker(["image", "inspect", image.registryRef]),
      )[0];
      if (
        actual.Architecture !== "amd64" ||
        actual.Config.Labels?.["org.opencontainers.image.revision"] !==
          m.commit ||
        actual.Id !== image.localId
      )
        throw Error("REGISTRY_IMAGE_IDENTITY_CHANGED");
    }
    m.status = "PUBLISHED";
    write(path.join(DIR, "manifest.json"), m);
    await checksums();
    console.log(
      "Published the exact qualified images. NAS acceptance and production approval remain pending.",
    );
  } finally {
    if (old === undefined) delete process.env.DOCKER_CONFIG;
    else process.env.DOCKER_CONFIG = old;
    if (
      path.dirname(path.resolve(tmp)) === path.resolve(os.tmpdir()) &&
      path.basename(tmp).startsWith("suivi-registry-")
    )
      fs.rmSync(tmp, { recursive: true, force: true });
  }
}
if (require.main === module)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
module.exports = { environmentGuard, tagAbsent };
