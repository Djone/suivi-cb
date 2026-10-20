const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const { ROOT, exec, write } = require("./common.cjs");
const { DIR, manifest, docker, checksums } = require("./candidate.cjs");
const runtimeUser =
  typeof process.getuid === "function"
    ? ["--user", String(process.getuid()) + ":" + String(process.getgid())]
    : [];
const SCANNER =
  "aquasec/trivy@sha256:9db099105405c648166e6b94155eb32f8da12673cf1f455207f7385cc9a77283";
function summarize(raw) {
  if (
    raw?.SchemaVersion !== 2 ||
    (raw.Results !== undefined && !Array.isArray(raw.Results))
  )
    throw Error("INVALID_SCAN_REPORT");
  const vulnerabilities = [],
    secrets = [];
  for (const result of raw.Results || []) {
    for (const v of result.Vulnerabilities || [])
      vulnerabilities.push({
        file: result.Target,
        id: v.VulnerabilityID,
        severity: v.Severity,
        package: v.PkgName,
        installed: v.InstalledVersion,
        fixed: v.FixedVersion || null,
      });
    for (const s of result.Secrets || [])
      secrets.push({
        file: result.Target,
        rule: s.RuleID,
        severity: s.Severity,
        start: s.StartLine,
        end: s.EndLine,
      });
  }
  return {
    status: vulnerabilities.length || secrets.length ? "FAIL" : "PASS",
    scannerVersion: raw.Trivy?.Version || null,
    vulnerabilities,
    secrets,
  };
}
async function main() {
  const m = manifest(),
    cache = path.join(ROOT, ".cache/ci/trivy-cache"),
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "suivi-scan-"));
  fs.mkdirSync(cache, { recursive: true });
  let failed = false;
  try {
    exec("git", [
      "archive",
      "--format=tar",
      "--output=" + path.join(tmp, "source.tar"),
      m.commit,
    ]);
    fs.mkdirSync(path.join(tmp, "source"));
    exec("tar", [
      "-xf",
      path.join(tmp, "source.tar"),
      "-C",
      path.join(tmp, "source"),
    ]);
    for (const target of ["source", "backend", "frontend"]) {
      const raw = path.join(tmp, target + ".raw.json");
      const mount = [
        "--mount",
        "type=bind,source=" + tmp + ",target=/work",
        "--mount",
        "type=bind,source=" + cache + ",target=/cache",
      ];
      if (target === "source")
        docker([
          "run",
          "--rm",
          ...runtimeUser,
          ...mount,
          SCANNER,
          "fs",
          "/work/source",
          "--cache-dir",
          "/cache",
          "--scanners",
          "secret",
          "--format",
          "json",
          "--output",
          "/work/" + target + ".raw.json",
        ]);
      else {
        docker([
          "save",
          "-o",
          path.join(tmp, target + ".tar"),
          m.images[target].localTag,
        ]);
        docker([
          "run",
          "--rm",
          ...runtimeUser,
          ...mount,
          SCANNER,
          "image",
          "--input",
          "/work/" + target + ".tar",
          "--cache-dir",
          "/cache",
          "--scanners",
          "vuln,secret",
          "--list-all-pkgs",
          "--format",
          "json",
          "--output",
          "/work/" + target + ".raw.json",
        ]);
      }
      const report = JSON.parse(fs.readFileSync(raw));
      const safe = summarize(report);
      write(path.join(DIR, target + "-scan.json"), {
        ...safe,
        commit: m.commit,
        configDigest: m.images[target]?.configDigest || null,
      });
      if (safe.status !== "PASS") failed = true;
      if (target !== "source") {
        delete report.Metadata?.ImageConfig;
        for (const r of report.Results || []) delete r.Secrets;
        fs.writeFileSync(raw, JSON.stringify(report));
        docker([
          "run",
          "--rm",
          ...runtimeUser,
          "--network",
          "none",
          ...mount,
          "--mount",
          "type=bind,source=" + DIR + ",target=/reports",
          SCANNER,
          "convert",
          "--format",
          "cyclonedx",
          "--output",
          "/reports/" + target + ".cdx.json",
          "/work/" + target + ".raw.json",
        ]);
      }
    }
    await checksums();
    if (failed) throw Error("SECURITY_SCAN_GATE_FAILED");
  } finally {
    if (
      path.dirname(path.resolve(tmp)) === path.resolve(os.tmpdir()) &&
      path.basename(tmp).startsWith("suivi-scan-")
    )
      fs.rmSync(tmp, { recursive: true, force: true });
  }
}
if (require.main === module)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
module.exports = { summarize };
