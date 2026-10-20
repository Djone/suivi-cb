const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
function createDsmKit({ root = path.resolve(__dirname, "../..") } = {}) {
  return function make() {
    const base = path.join(root, ".cache/ci");
    fs.mkdirSync(base, { recursive: true });
    const parent = fs.mkdtempSync(path.join(base, "dsm-executor-"));
    const kit = path.join(parent, "dsm-executor");
    fs.mkdirSync(kit, { mode: 0o700 });
    const copy = (source, target = source) => {
      const dst = path.join(kit, target);
      fs.mkdirSync(path.dirname(dst), { recursive: true, mode: 0o700 });
      fs.writeFileSync(
        dst,
        fs.readFileSync(path.join(root, source), "utf8").replace(/\r\n/g, "\n"),
        {
          mode: 0o600,
        },
      );
    };
    for (const file of [
      "nas-preproduction.sh",
      "sqlite-snapshot.cjs",
      "validate-bundle.cjs",
      "dsm-request.cjs",
      "dsm-worker.sh",
    ])
      copy("deploy-controller/" + file, "code/deploy-controller/" + file);
    for (const file of ["common.cjs", "contracts.cjs"])
      copy("scripts/ci/" + file, "code/scripts/ci/" + file);
    for (const file of [
      "install-dsm-executor.sh",
      "dsm-key-entry.sh",
      "dsm-receive-request.sh",
    ])
      copy("deploy-controller/guide/" + file, file);
    const initial = fs.readFileSync(
      path.join(root, "deploy-controller/guide/install-release-ssh.sh"),
      "utf8",
    );
    const entry = initial.match(/<<'ENTRY'\r?\n([\s\S]*?)\r?\nENTRY/);
    if (!entry) throw Error("SSH_ENTRY_TEMPLATE_INVALID");
    const sha = crypto
      .createHash("sha256")
      .update(entry[1].replace(/\r\n/g, "\n") + "\n")
      .digest("hex");
    const install = path.join(kit, "install-dsm-executor.sh");
    fs.writeFileSync(
      install,
      fs.readFileSync(install, "utf8").replaceAll("__ENTRY_SHA__", sha),
      { mode: 0o600 },
    );
    fs.writeFileSync(
      path.join(kit, "README.txt"),
      "Install as root after review: sh install-dsm-executor.sh\nThen create a DSM root task every minute: sh /volume1/docker/suivi-cb-deployment-control/code/deploy-controller/dsm-worker.sh\nPlan only by default. No deployment enable files are created. No production action exists.\n",
      { mode: 0o600 },
    );
    const inventory = [];
    const walk = (dir, prefix = "") => {
      for (const name of fs.readdirSync(dir)) {
        const file = path.join(dir, name),
          rel = prefix + name;
        if (fs.statSync(file).isDirectory()) walk(file, rel + "/");
        else
          inventory.push(
            crypto
              .createHash("sha256")
              .update(fs.readFileSync(file))
              .digest("hex") +
              "  " +
              rel,
          );
      }
    };
    walk(kit);
    fs.writeFileSync(
      path.join(kit, "SHA256SUMS"),
      inventory.sort().join("\n") + "\n",
      { mode: 0o600 },
    );
    const file = path.join(parent, "dsm-executor.tar.gz");
    execFileSync("tar", ["-czf", file, "-C", parent, "dsm-executor"], {
      timeout: 30000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { file, name: "dsm-executor.tar.gz", directory: kit };
  };
}
module.exports = { createDsmKit };
