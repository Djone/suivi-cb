const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
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
      const dsmInstalled = dsmReady();
      return {
        ...status(),
        connected: true,
        dsmInstalled,
        capabilities: dsmInstalled ? ["probe", "queue", "receipt"] : ["probe"],
      };
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
  const history = path.join(root, "data/release/dsm-requests");
  const lastFile = path.join(history, "last.json");
  const noncePattern =
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
  function record(value) {
    fs.mkdirSync(history, { recursive: true, mode: 0o700 });
    if (
      fs.realpathSync(history) !==
      path.join(fs.realpathSync(root), "data/release/dsm-requests")
    )
      throw Error("UNSAFE_DSM_HISTORY");
    const temporary = path.join(history, crypto.randomUUID() + ".tmp");
    fs.writeFileSync(temporary, JSON.stringify(value), {
      flag: "wx",
      mode: 0o600,
    });
    fs.renameSync(temporary, lastFile);
  }
  function latest() {
    if (!fs.existsSync(lastFile)) return null;
    if (
      fs.lstatSync(lastFile).isSymbolicLink() ||
      fs.statSync(lastFile).size > 16384
    )
      throw Error("UNSAFE_DSM_HISTORY");
    return JSON.parse(fs.readFileSync(lastFile, "utf8"));
  }
  function execute(command, input) {
    if (!publicKey()) throw Error("SSH_KEY_REQUIRED");
    return run(
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
        command,
      ],
      {
        encoding: "utf8",
        input,
        timeout: 15000,
        maxBuffer: 65536,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
  }
  function dsmReady() {
    try {
      const r = JSON.parse(
        execute("suivi-cb-receipt 00000000-0000-4000-8000-000000000000"),
      );
      return r.pending === true && Object.keys(r).length === 1;
    } catch {
      return false;
    }
  }
  function queue(input) {
    const report = evidence?.read(),
      d = report?.dossier;
    if (
      !d ||
      !report.readyForPreproduction ||
      input?.identity !== d.identity ||
      input.revision !== d.revision ||
      !["plan", "apply-preproduction"].includes(input.action) ||
      (input.action === "apply-preproduction" && input.confirm !== true)
    )
      throw Error("DSM_REQUEST_BLOCKED");
    if (
      !/^[a-f0-9]{64}$/.test(d.identity) ||
      !/^2\.2\.0-rc\.[1-9][0-9]*$/.test(d.manifest.candidate) ||
      !/^[a-f0-9]{40}$/.test(d.manifest.commit) ||
      !/^[a-f0-9]{64}$/.test(d.manifest.archiveSha256)
    )
      throw Error("INVALID_DSM_CANDIDATE");
    if (!dsmReady()) throw Error("DSM_EXECUTOR_INSTALL_REQUIRED");
    const previous = latest();
    if (
      input.action === "apply-preproduction" &&
      (!previous ||
        previous.status !== "PLAN_PASS" ||
        previous.request.identity !== d.identity ||
        previous.request.candidate !== d.manifest.candidate ||
        previous.request.commit !== d.manifest.commit ||
        previous.request.archiveSha256 !== d.manifest.archiveSha256)
    )
      throw Error("DSM_PLAN_REQUIRED");
    if (previous && ["QUEUED", "DELIVERY_UNKNOWN"].includes(previous.status))
      throw Error("DSM_REQUEST_PENDING");
    const request = {
      schema: 1,
      nonce: crypto.randomUUID(),
      action: input.action,
      identity: d.identity,
      candidate: d.manifest.candidate,
      commit: d.manifest.commit,
      archiveSha256: d.manifest.archiveSha256,
      requestedAt: new Date().toISOString(),
    };
    const value = { request, status: "DELIVERY_UNKNOWN" };
    record(value);
    try {
      if (
        execute("suivi-cb-queue", JSON.stringify(request)).trim() !==
        "SUIVI_CB_REQUEST_QUEUED"
      )
        throw Error();
    } catch {
      throw Error("DSM_QUEUE_DELIVERY_UNKNOWN");
    }
    value.status = "QUEUED";
    record(value);
    return value;
  }
  function receipt(nonce) {
    const value = latest();
    if (
      !noncePattern.test(nonce || "") ||
      !value ||
      value.request.nonce !== nonce
    )
      throw Error("UNKNOWN_DSM_REQUEST");
    let result;
    try {
      result = JSON.parse(execute("suivi-cb-receipt " + nonce));
    } catch {
      throw Error("DSM_RECEIPT_UNAVAILABLE");
    }
    if (result.pending === true && Object.keys(result).length === 1)
      return { ...value, pending: true };
    const r = value.request;
    if (
      result.schema !== 1 ||
      result.nonce !== nonce ||
      result.identity !== r.identity ||
      result.candidate !== r.candidate ||
      result.commit !== r.commit ||
      result.action !== r.action ||
      result.archiveSha256 !== r.archiveSha256 ||
      result.productionApproved !== false ||
      result.databaseRestored !== false ||
      ![
        "PLAN_PASS",
        "PREPRODUCTION_SMOKE_PASS",
        "FAILED",
        "APPLY_DISABLED",
        "PLAN_REQUIRED",
      ].includes(result.status)
    )
      throw Error("DSM_RECEIPT_MISMATCH");
    if (
      (result.action === "plan" &&
        !["PLAN_PASS", "FAILED"].includes(result.status)) ||
      (result.action === "apply-preproduction" &&
        ![
          "PREPRODUCTION_SMOKE_PASS",
          "FAILED",
          "APPLY_DISABLED",
          "PLAN_REQUIRED",
        ].includes(result.status))
    )
      throw Error("DSM_RECEIPT_MISMATCH");
    value.status = result.status;
    value.receipt = Object.fromEntries(
      [
        "schema",
        "nonce",
        "identity",
        "candidate",
        "commit",
        "action",
        "archiveSha256",
        "status",
        "productionApproved",
        "databaseRestored",
      ].map((k) => [k, result[k]]),
    );
    record(value);
    return value;
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
  return { create, status, probe, plan, installer, queue, receipt, latest };
}
module.exports = { createNasSsh };
