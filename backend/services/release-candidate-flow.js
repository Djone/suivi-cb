const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { pipeline } = require("node:stream/promises");
const { Transform } = require("node:stream");
const REPO = "Djone/suivi-cb";
const SHA = /^[a-f0-9]{40}$/;
const RUN = /^[1-9][0-9]{0,19}$/;
function gitAt(root, args) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      timeout: 15000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    throw Error("GIT_UNAVAILABLE");
  }
}
function credential(root) {
  try {
    const text = execFileSync(
      "git",
      ["-c", "credential.interactive=never", "credential", "fill"],
      {
        cwd: root,
        input: "protocol=https\nhost=github.com\npath=Djone/suivi-cb.git\n\n",
        encoding: "utf8",
        timeout: 15000,
        maxBuffer: 65536,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: "0",
          GCM_INTERACTIVE: "never",
        },
      },
    );
    const password = text
      .split(/\r?\n/)
      .find((l) => l.startsWith("password="))
      ?.slice(9);
    if (!password) throw Error();
    return password;
  } catch {
    throw Error("GITHUB_LOGIN_REQUIRED");
  }
}
function nativeRequest(root) {
  return async (route, { raw = false } = {}) => {
    if (!route.startsWith("/")) throw Error("INVALID_GITHUB_ROUTE");
    const token = credential(root);
    let response;
    try {
      response = await fetch("https://api.github.com/repos/" + REPO + route, {
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/vnd.github+json",
          "User-Agent": "suivi-cb-release-process",
          "X-GitHub-Api-Version": "2026-03-10",
        },
        redirect: "manual",
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      throw Error("GITHUB_UNAVAILABLE");
    }
    if (raw && response.status === 302) return response;
    if (!response.ok)
      throw Error(
        response.status === 401 || response.status === 403
          ? "GITHUB_LOGIN_REQUIRED"
          : "GITHUB_UNAVAILABLE",
      );
    return response.json();
  };
}
async function shaFile(file) {
  const h = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) h.update(chunk);
  return h.digest("hex");
}
async function extractZip(file, dir) {
  const zip = await require("yauzl").openPromise(file, {
    lazyEntries: true,
    strictFileNames: true,
    validateEntrySizes: true,
  });
  let count = 0,
    total = 0;
  const seen = new Set();
  try {
    for await (const e of zip.eachEntry()) {
      const mode = (e.externalFileAttributes >>> 16) & 0xf000;
      if (
        ++count > 80 ||
        !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(e.fileName) ||
        e.fileName.length > 128 ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(e.fileName) ||
        seen.has(e.fileName.toLowerCase()) ||
        (mode !== 0 && mode !== 0x8000)
      )
        throw Error("UNSAFE_ARTIFACT_ARCHIVE");
      seen.add(e.fileName.toLowerCase());
      total += e.uncompressedSize;
      if (
        total > 2 * 1024 ** 3 ||
        (e.fileName !== "images.tar" && e.uncompressedSize > 8 * 1024 ** 2)
      )
        throw Error("ARTIFACT_TOO_LARGE");
      let bytes = 0;
      const limit = new Transform({
        transform(chunk, _encoding, cb) {
          bytes += chunk.length;
          if (bytes > e.uncompressedSize) cb(Error("ARTIFACT_TOO_LARGE"));
          else cb(null, chunk);
        },
      });
      await pipeline(
        await zip.openReadStreamPromise(e),
        limit,
        fs.createWriteStream(path.join(dir, e.fileName), {
          flags: "wx",
          mode: 0o600,
        }),
      );
    }
  } finally {
    zip.close();
  }
  if (
    !seen.has("manifest.json") ||
    !seen.has("SHA256SUMS") ||
    !seen.has("images.tar")
  )
    throw Error("INCOMPLETE_ARTIFACT");
}
function createCandidateFlow({
  root = path.resolve(__dirname, "../.."),
  evidence,
  git,
  request,
  extract = extractZip,
  download,
} = {}) {
  const gitRun = git || ((args) => gitAt(root, args));
  const api = request || nativeRequest(root);
  let busy = false,
    completion = null;
  const cache = path.join(root, ".cache/ci");
  const stateFile = path.join(cache, "candidate-flow.json");
  let lastInspection = null;
  function task() {
    if (!fs.existsSync(stateFile)) return null;
    try {
      const t = JSON.parse(fs.readFileSync(stateFile, "utf8"));
      if (t.status === "downloading" && !busy) t.status = "interrupted";
      return t;
    } catch {
      return null;
    }
  }
  function save(value) {
    fs.mkdirSync(cache, { recursive: true, mode: 0o700 });
    const tmp = path.join(
      cache,
      "candidate-flow-" + crypto.randomUUID() + ".tmp",
    );
    fs.writeFileSync(tmp, JSON.stringify(value), { flag: "wx", mode: 0o600 });
    fs.renameSync(tmp, stateFile);
  }
  async function inspect() {
    const result = {
      branch: null,
      commit: null,
      clean: false,
      pushed: false,
      protected: false,
      ready: false,
      run: null,
      artifact: null,
      blockers: [],
      task: task(),
    };
    try {
      const origin = gitRun(["config", "--get", "remote.origin.url"]);
      if (
        !/^(https:\/\/github\.com\/Djone\/suivi-cb(?:\.git)?|git@github\.com:Djone\/suivi-cb(?:\.git)?)$/i.test(
          origin,
        )
      )
        throw Error("WRONG_REPOSITORY");
      result.commit = gitRun(["rev-parse", "HEAD"]);
      result.branch = gitRun(["branch", "--show-current"]);
      result.clean = !gitRun([
        "status",
        "--porcelain",
        "--untracked-files=all",
      ]);
      if (!SHA.test(result.commit)) throw Error("GIT_UNAVAILABLE");
      if (!result.clean) result.blockers.push("WORKTREE_DIRTY");
      if (!["master", "2.2.0-dev"].includes(result.branch)) {
        result.blockers.push("MERGE_PR_FIRST");
        return result;
      }
      const branch = await api(
        "/branches/" + encodeURIComponent(result.branch),
      );
      result.pushed = branch.commit?.sha === result.commit;
      result.protected = branch.protected === true;
      if (!result.pushed) result.blockers.push("PUSH_OR_PULL_REQUIRED");
      if (!result.protected) result.blockers.push("BRANCH_NOT_PROTECTED");
      if (!result.pushed) return result;
      const runs = await api(
        "/actions/workflows/ci.yml/runs?event=push&branch=" +
          encodeURIComponent(result.branch) +
          "&head_sha=" +
          result.commit +
          "&per_page=20",
      );
      const run = runs.workflow_runs?.find(
        (r) =>
          r.head_sha === result.commit &&
          r.head_branch === result.branch &&
          r.event === "push" &&
          r.path === ".github/workflows/ci.yml",
      );
      if (!run || !RUN.test(String(run.id))) {
        result.blockers.push("CI_NOT_FOUND");
        return result;
      }
      result.run = {
        id: String(run.id),
        status: run.status,
        conclusion: run.conclusion,
        url: "https://github.com/" + REPO + "/actions/runs/" + run.id,
      };
      if (run.status !== "completed" || run.conclusion !== "success") {
        result.blockers.push(
          run.status === "completed" ? "CI_FAILED" : "CI_RUNNING",
        );
        return result;
      }
      const jobs = await api("/actions/runs/" + run.id + "/jobs?per_page=100");
      if (
        !["Quality", "Docker and browser qualification", "Required CI"].every(
          (n) =>
            jobs.jobs?.some((j) => j.name === n && j.conclusion === "success"),
        )
      ) {
        result.blockers.push("CI_CHECKS_MISSING");
        return result;
      }
      const artifacts = await api(
        "/actions/runs/" + run.id + "/artifacts?per_page=100",
      );
      const a = artifacts.artifacts?.find(
        (a) => a.name === "candidate-" + run.id && !a.expired,
      );
      if (
        !a ||
        !RUN.test(String(a.id)) ||
        !/^sha256:[a-f0-9]{64}$/.test(a.digest) ||
        a.size_in_bytes > 512 * 1024 ** 2 ||
        (a.workflow_run?.head_sha && a.workflow_run.head_sha !== result.commit)
      ) {
        result.blockers.push("ARTIFACT_MISSING");
        return result;
      }
      result.artifact = {
        id: String(a.id),
        digest: a.digest,
        size: a.size_in_bytes,
      };
      result.ready = result.blockers.length === 0;
    } catch (e) {
      result.blockers.push(
        /^[A-Z_]+$/.test(e.message) ? e.message : "GITHUB_UNAVAILABLE",
      );
    } finally {
      lastInspection = result;
    }
    return result;
  }
  async function retrieve(snapshot, actor) {
    const runId = snapshot.run.id;
    const base = path.join(cache, "github-run-" + runId);
    fs.mkdirSync(base, { recursive: true, mode: 0o700 });
    if (
      fs.realpathSync(base) !==
      path.join(fs.realpathSync(root), ".cache/ci/github-run-" + runId)
    )
      throw Error("UNSAFE_STAGING_PATH");
    const zipFile = path.join(base, "download-" + crypto.randomUUID() + ".zip");
    const stage = fs.mkdtempSync(path.join(base, ".candidate-download-"));
    const target = path.join(base, "candidate-" + runId);
    try {
      if (download) await download(snapshot, zipFile);
      else {
        const response = await api(
          "/actions/artifacts/" + snapshot.artifact.id + "/zip",
          { raw: true },
        );
        const location = new URL(response.headers.get("location"));
        if (
          location.protocol !== "https:" ||
          !/\.blob\.core\.windows\.net$|\.actions\.githubusercontent\.com$/.test(
            location.hostname,
          )
        )
          throw Error("UNSAFE_ARTIFACT_REDIRECT");
        // A fresh request without Authorization: never forward the GitHub credential.
        const data = await fetch(location, {
          redirect: "error",
          signal: AbortSignal.timeout(300000),
        });
        if (!data.ok) throw Error("ARTIFACT_DOWNLOAD_FAILED");
        let bytes = 0;
        const limit = new Transform({
          transform(c, _e, cb) {
            bytes += c.length;
            cb(bytes > 512 * 1024 ** 2 ? Error("ARTIFACT_TOO_LARGE") : null, c);
          },
        });
        await pipeline(
          data.body,
          limit,
          fs.createWriteStream(zipFile, { flags: "wx", mode: 0o600 }),
        );
      }
      if ("sha256:" + (await shaFile(zipFile)) !== snapshot.artifact.digest)
        throw Error("ARTIFACT_DIGEST_MISMATCH");
      await extract(zipFile, stage);
      const m = JSON.parse(
        fs.readFileSync(path.join(stage, "manifest.json"), "utf8"),
      );
      if (
        m.commit !== snapshot.commit ||
        String(m.runId) !== runId ||
        m.candidate !== "2.2.0-rc." + runId ||
        m.status !== "QUALIFIED"
      )
        throw Error("ARTIFACT_SOURCE_MISMATCH");
      if (fs.existsSync(target)) {
        const names = fs.readdirSync(stage).sort();
        if (
          fs.lstatSync(target).isSymbolicLink() ||
          names.join(",") !== fs.readdirSync(target).sort().join(",")
        )
          throw Error("STAGED_ARTIFACT_CONFLICT");
        for (const n of names)
          if (
            !fs.lstatSync(path.join(target, n)).isFile() ||
            fs.lstatSync(path.join(target, n)).isSymbolicLink() ||
            (await shaFile(path.join(stage, n))) !==
              (await shaFile(path.join(target, n)))
          )
            throw Error("STAGED_ARTIFACT_CONFLICT");
      } else fs.renameSync(stage, target);
      const kept = path.join(base, "candidate-" + runId + ".zip");
      if (fs.existsSync(kept)) {
        if (
          fs.lstatSync(kept).isSymbolicLink() ||
          "sha256:" + (await shaFile(kept)) !== snapshot.artifact.digest
        )
          throw Error("STAGED_ARTIFACT_CONFLICT");
      } else fs.renameSync(zipFile, kept);
      const report = await evidence.importBundle(
        { source: "github", runId },
        actor,
        {
          repository: REPO,
          runId,
          commit: snapshot.commit,
          artifactId: snapshot.artifact.id,
          artifactDigest: snapshot.artifact.digest,
        },
      );
      return report.dossier.manifest.candidate;
    } finally {
      // Only our random staging directory, under this fixed run directory, may be removed.
      if (
        fs.existsSync(stage) &&
        path.resolve(stage).startsWith(path.resolve(base) + path.sep) &&
        path.basename(stage).startsWith(".candidate-download-") &&
        !fs.lstatSync(stage).isSymbolicLink()
      )
        fs.rmSync(stage, { recursive: true, force: true });
      if (fs.existsSync(zipFile)) fs.unlinkSync(zipFile);
    }
  }
  async function prepare(input, actor) {
    if (busy) throw Error("CANDIDATE_BUSY");
    busy = true;
    try {
      const s = await inspect();
      if (!s.ready) throw Error("CANDIDATE_PREREQUISITES_MISSING");
      if (input?.commit !== s.commit) throw Error("GIT_CHANGED_REFRESH");
      const job = {
        id: crypto.randomUUID(),
        status: "downloading",
        commit: s.commit,
        artifactDigest: s.artifact.digest,
        runId: s.run.id,
        startedAt: new Date().toISOString(),
        candidate: null,
        error: null,
      };
      save(job);
      completion = retrieve(s, actor)
        .then((version) => {
          save({
            ...job,
            status: "ready",
            candidate: version,
            endedAt: new Date().toISOString(),
          });
        })
        .catch((e) => {
          save({
            ...job,
            status: "failed",
            error: /^[A-Z_]+$/.test(e.message)
              ? e.message
              : "ARTIFACT_DOWNLOAD_FAILED",
            endedAt: new Date().toISOString(),
          });
        })
        .finally(() => {
          busy = false;
        })
        .catch(() => undefined);
      return { ...s, task: job };
    } catch (e) {
      busy = false;
      throw e;
    }
  }
  async function archive() {
    const t = task(),
      d = evidence.read().dossier;
    if (
      t?.status !== "ready" ||
      !RUN.test(t.runId) ||
      d?.manifest?.commit !== t.commit ||
      String(d.manifest.runId) !== t.runId
    )
      throw Error("CANDIDATE_NOT_READY");
    const file = path.join(
      cache,
      "github-run-" + t.runId,
      "candidate-" + t.runId + ".zip",
    );
    if (
      fs.lstatSync(file).isSymbolicLink() ||
      "sha256:" + (await shaFile(file)) !== t.artifactDigest
    )
      throw Error("ARTIFACT_DIGEST_MISMATCH");
    return { file, name: "candidate-" + t.runId + ".zip" };
  }
  return {
    inspect,
    prepare,
    archive,
    status: () =>
      busy ? Promise.resolve({ ...lastInspection, task: task() }) : inspect(),
    wait: () => completion,
  };
}
module.exports = { createCandidateFlow, extractZip };
