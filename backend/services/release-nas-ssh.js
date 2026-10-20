const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
function createNasSsh({
  root = path.resolve(__dirname, "../.."),
  run = execFileSync,
  evidence,
} = {}) {
  const directory = path.join(root, "data/release/ssh");
  const key = path.join(directory, "id_ed25519");
  function publicKey() {
    if (!fs.existsSync(key)) return null;
    for (const p of [directory, key, key + ".pub"]) {
      if (fs.lstatSync(p).isSymbolicLink()) throw Error("SSH_KEY_PATH_UNSAFE");
    }
    const value = fs.readFileSync(key + ".pub", "utf8").trim();
    if (!/^ssh-ed25519 [A-Za-z0-9+/=]+ suivi-cb-release-local$/.test(value))
      throw Error("SSH_KEY_INVALID");
    return value;
  }
  function create(input) {
    if (input?.confirm !== true) throw Error("SSH_KEY_CONFIRMATION_REQUIRED");
    if (!fs.existsSync(key)) {
      fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
      if (
        fs.realpathSync(directory) !==
        path.join(fs.realpathSync(root), "data/release/ssh")
      )
        throw Error("SSH_KEY_PATH_UNSAFE");
      if (process.platform === "win32") {
        const who = run("whoami", ["/user", "/fo", "csv", "/nh"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        });
        const sid = who.match(/S-1-[0-9-]+/)?.[0];
        if (!sid) throw Error("SSH_KEY_PERMISSIONS_FAILED");
        run(
          "icacls",
          [directory, "/inheritance:r", "/grant:r", "*" + sid + ":(OI)(CI)F"],
          { stdio: ["ignore", "pipe", "pipe"] },
        );
      }
      run(
        "ssh-keygen",
        ["-t", "ed25519", "-N", "", "-C", "suivi-cb-release-local", "-f", key],
        { timeout: 15000, stdio: ["ignore", "pipe", "pipe"] },
      );
      fs.chmodSync(key, 0o600);
    }
    return { configured: true, publicKey: publicKey() };
  }
  function status() {
    return {
      configured: Boolean(publicKey()),
      host: "192.168.1.113",
      port: 1122,
      account: "GodOfNasAugerie",
      capabilities: ["probe"],
      productionEnabled: false,
    };
  }
  function probe() {
    if (!publicKey()) throw Error("SSH_KEY_REQUIRED");
    try {
      const output = run(
        "ssh",
        [
          "-T",
          "-i",
          key,
          "-o",
          "BatchMode=yes",
          "-o",
          "IdentitiesOnly=yes",
          "-o",
          "StrictHostKeyChecking=yes",
          "-o",
          "ConnectTimeout=5",
          "-p",
          "1122",
          "GodOfNasAugerie@192.168.1.113",
          "suivi-cb-probe",
        ],
        {
          encoding: "utf8",
          timeout: 10000,
          maxBuffer: 65536,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      if (output.trim() !== "SUIVI_CB_SSH_READY") throw Error();
      return { ...status(), connected: true };
    } catch {
      throw Error("SSH_CONNECTION_OR_INSTALLATION_REQUIRED");
    }
  }
  function plan(input) {
    const report = evidence?.read();
    const d = report?.dossier;
    if (
      !d ||
      !report.readyForPreproduction ||
      input?.identity !== d.identity ||
      input.revision !== d.revision
    )
      throw Error("PREPRODUCTION_PLAN_BLOCKED");
    if (!publicKey()) throw Error("SSH_KEY_REQUIRED");
    let output;
    try {
      output = run(
        "ssh",
        [
          "-T",
          "-i",
          key,
          "-o",
          "BatchMode=yes",
          "-o",
          "IdentitiesOnly=yes",
          "-o",
          "StrictHostKeyChecking=yes",
          "-o",
          "ConnectTimeout=5",
          "-p",
          "1122",
          "GodOfNasAugerie@192.168.1.113",
          "suivi-cb-plan",
        ],
        {
          encoding: "utf8",
          timeout: 90000,
          maxBuffer: 65536,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
    } catch {
      throw Error("SSH_CONNECTION_OR_INSTALLATION_REQUIRED");
    }
    const match = output.match(
      /^Target=preproduction Candidate=(2\.2\.0-rc\.[1-9][0-9]*) Commit=([a-f0-9]{40}) Run=([1-9][0-9]*) Port=127\.0\.0\.1:4205$/m,
    );
    if (
      !match ||
      !output.includes("PLAN_ONLY: no application service changed.") ||
      match[1] !== d.manifest.candidate ||
      match[2] !== d.manifest.commit ||
      match[3] !== String(d.manifest.runId)
    )
      throw Error("NAS_STAGED_CANDIDATE_MISMATCH");
    return {
      candidate: match[1],
      commit: match[2],
      runId: match[3],
      planOnly: true,
    };
  }
  function installer() {
    const pub = publicKey();
    if (!pub) throw Error("SSH_KEY_REQUIRED");
    return fs
      .readFileSync(
        path.join(root, "deploy-controller/guide/install-release-ssh.sh"),
        "utf8",
      )
      .replaceAll("__PUBLIC_KEY__", pub);
  }
  return { create, status, probe, plan, installer };
}
module.exports = { createNasSsh };
