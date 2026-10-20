const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const ROOT = path.resolve(__dirname, "../..");
function exec(
  program,
  args,
  { capture = false, cwd = ROOT, timeout = 1800000 } = {},
) {
  const r = spawnSync(program, args, {
    cwd,
    encoding: "utf8",
    timeout,
    maxBuffer: 32000000,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (r.status !== 0) throw Error("COMMAND_FAILED:" + program + ":" + args[0]);
  return capture ? r.stdout.trim() : "";
}
function npm(args, options = {}) {
  if (process.platform === "win32") {
    if (args.some((a) => !/^[a-zA-Z0-9_./:@=*-]+$/.test(a)))
      throw Error("UNSAFE_NPM_ARGUMENT");
    return exec(
      process.env.ComSpec,
      ["/d", "/s", "/c", "npm " + args.join(" ")],
      options,
    );
  }
  return exec("npm", args, options);
}
function hash(file) {
  return new Promise((ok, no) => {
    const h = crypto.createHash("sha256"),
      s = fs.createReadStream(file);
    s.on("error", no);
    s.on("data", (b) => h.update(b));
    s.on("end", () => ok(h.digest("hex")));
  });
}
function write(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}
function revision() {
  return exec("git", ["rev-parse", "HEAD"], { capture: true });
}
function clean() {
  const status = exec(
    "git",
    ["status", "--porcelain", "--untracked-files=all"],
    { capture: true },
  );
  if (status) {
    console.error("Uncommitted paths:\n" + status);
    throw Error("CLEAN_COMMIT_REQUIRED");
  }
  return revision();
}
function candidate(v) {
  if (!/^2\.2\.0-rc\.[1-9][0-9]*$/.test(v || ""))
    throw Error("INVALID_CANDIDATE");
  return v;
}
function registryRef(v, service) {
  if (
    !/^ghcr\.io\/djone\/suivi-cb-(backend|frontend)@sha256:[a-f0-9]{64}$/.test(
      v,
    ) ||
    !v.startsWith("ghcr.io/djone/suivi-cb-" + service + "@")
  )
    throw Error("INVALID_REGISTRY_REF");
  return v;
}
module.exports = {
  ROOT,
  exec,
  npm,
  hash,
  write,
  revision,
  clean,
  candidate,
  registryRef,
};
