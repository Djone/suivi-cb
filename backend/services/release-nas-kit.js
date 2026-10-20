const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
function createNasKit({
  root = path.resolve(__dirname, "../.."),
  evidence,
} = {}) {
  return async function (input, actor) {
    const r = evidence.read(),
      d = r.dossier;
    if (
      input?.confirmPreproduction !== true ||
      !r.readyForPreproduction ||
      !d ||
      input.identity !== d.identity ||
      input.revision !== d.revision
    )
      throw Error("PREPRODUCTION_KIT_BLOCKED");
    const m = d.manifest;
    if (
      !/^2\.2\.0-rc\.[1-9][0-9]*$/.test(m.candidate) ||
      !/^[1-9][0-9]*$/.test(String(m.runId))
    )
      throw Error("INVALID_CANDIDATE");
    const base = path.join(root, ".cache/ci");
    fs.mkdirSync(base, { recursive: true, mode: 0o700 });
    const parent = fs.mkdtempSync(path.join(base, "nas-kit-"));
    const kit = path.join(parent, "nas-kit");
    fs.mkdirSync(kit, { mode: 0o700 });
    function write(name, text) {
      const file = path.join(kit, name);
      fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
      fs.writeFileSync(file, text, { mode: 0o600 });
    }
    for (const name of [
      "nas-preproduction.sh",
      "sqlite-snapshot.cjs",
      "validate-bundle.cjs",
    ])
      write(
        "code/deploy-controller/" + name,
        fs.readFileSync(path.join(root, "deploy-controller", name)),
      );
    for (const name of ["common.cjs", "contracts.cjs"])
      write(
        "code/scripts/ci/" + name,
        fs.readFileSync(path.join(root, "scripts/ci", name)),
      );
    for (const name of [
      "prepare-preproduction.sh",
      "apply-preproduction.sh",
      "check-production.sh",
      "test-rollback.sh",
      "check-backup.sh",
      "transfer-to-nas.ps1",
    ])
      write(
        name,
        fs
          .readFileSync(
            path.join(root, "deploy-controller/guide", name),
            "utf8",
          )
          .replaceAll("__CANDIDATE__", m.candidate)
          .replaceAll("__RUN__", String(m.runId))
          .replaceAll(
            "__ZIP_SHA__",
            /^sha256:[a-f0-9]{64}$/.test(d.origin?.artifactDigest || "")
              ? d.origin.artifactDigest.slice(7)
              : "",
          ),
      );
    write(
      "env.preprod.example",
      "KEYCLOAK_URL=https://auth.jolurie.com\nKEYCLOAK_REALM=suivi-cb-preprod\nKEYCLOAK_CLIENT_ID=suivi-cb-web\nKEYCLOAK_AUDIENCE=suivi-cb-api\nDOCUMENTATION_DISABLED=true\n",
    );
    write(
      "approval.json",
      JSON.stringify(
        {
          target: "preproduction",
          candidate: m.candidate,
          commit: m.commit,
          archiveSha256: m.archiveSha256,
          runId: m.runId,
          approved: true,
          approvedBy:
            String(actor)
              .replace(/[^a-zA-Z0-9-]/g, "")
              .slice(0, 39) || "local-operator",
          approvedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    write("manifest.json", JSON.stringify(m, null, 2));
    write(
      "README.txt",
      "PREPRODUCTION ONLY. Extract this nas-kit folder alongside candidate-" +
        m.runId +
        " in /volume1/docker/suivi-cb-preprod/releases/" +
        m.candidate +
        "/ . Run prepare-preproduction.sh with sudo, inspect PLAN_ONLY, then explicitly run apply-preproduction.sh. No production command is executed by this kit. Test and approve the exact images before any production plan. Never restore the production database automatically.",
    );
    const files = [];
    const walk = (dir, prefix = "") => {
      for (const n of fs.readdirSync(dir)) {
        const relative = prefix + n,
          file = path.join(dir, n);
        if (fs.statSync(file).isDirectory()) walk(file, relative + "/");
        else
          files.push(
            crypto
              .createHash("sha256")
              .update(fs.readFileSync(file))
              .digest("hex") +
              "  " +
              relative,
          );
      }
    };
    walk(kit);
    write("SHA256SUMS", files.join("\n") + "\n");
    const file = path.join(parent, "nas-kit-" + m.candidate + ".tar.gz");
    try {
      execFileSync("tar", ["-czf", file, "-C", parent, "nas-kit"], {
        cwd: root,
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 30000,
      });
    } catch {
      throw Error("NAS_KIT_ARCHIVER_UNAVAILABLE");
    }
    return { file, name: "nas-kit-" + m.candidate + ".tar.gz" };
  };
}
module.exports = { createNasKit };
