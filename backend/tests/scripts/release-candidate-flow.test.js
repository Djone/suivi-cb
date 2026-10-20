const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  crypto = require("node:crypto");
const {
  createCandidateFlow,
  extractZip,
} = require("../../services/release-candidate-flow");
const { createNasKit } = require("../../services/release-nas-kit");
const { execFileSync } = require("node:child_process");
function zip(entries) {
  let offset = 0;
  const locals = [],
    central = [];
  for (const e of entries) {
    const name = Buffer.from(e.name),
      data = Buffer.from(e.data);
    let crc = 0xffffffff;
    for (const x of data) {
      crc ^= x;
      for (let b = 0; b < 8; b++)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50);
    h.writeUInt16LE(20, 4);
    h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(data.length, 18);
    h.writeUInt32LE(data.length, 22);
    h.writeUInt16LE(name.length, 26);
    locals.push(h, name, data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50);
    c.writeUInt16LE(0x0314, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(data.length, 20);
    c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(name.length, 28);
    c.writeUInt32LE(((e.mode || 0x8000) << 16) >>> 0, 38);
    c.writeUInt32LE(offset, 42);
    central.push(c, name);
    offset += 30 + name.length + data.length;
  }
  const d = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(d.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, d, end]);
}
const digest = (x) =>
  "sha256:" + crypto.createHash("sha256").update(x).digest("hex");
let root, head, bytes, evidence, api, options, flow;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "release-flow-"));
  head = "a".repeat(40);
  bytes = zip([
    {
      name: "manifest.json",
      data: JSON.stringify({
        candidate: "2.2.0-rc.501",
        commit: head,
        runId: "501",
        status: "QUALIFIED",
      }),
    },
    { name: "images.tar", data: "synthetic" },
    { name: "SHA256SUMS", data: "synthetic" },
  ]);
  let dossier = null;
  evidence = {
    read: () => ({ dossier }),
    importBundle: jest.fn(async () => {
      dossier = {
        manifest: { candidate: "2.2.0-rc.501", commit: head, runId: "501" },
      };
      return { dossier };
    }),
  };
  api = jest.fn(async (route) => {
    if (route.startsWith("/branches/"))
      return { protected: true, commit: { sha: head } };
    if (route.includes("/workflows/"))
      return {
        workflow_runs: [
          {
            id: 501,
            head_sha: head,
            head_branch: "2.2.0-dev",
            event: "push",
            path: ".github/workflows/ci.yml",
            status: "completed",
            conclusion: "success",
          },
        ],
      };
    if (route.includes("/jobs"))
      return {
        jobs: [
          "Quality",
          "Docker and browser qualification",
          "Required CI",
        ].map((name) => ({ name, conclusion: "success" })),
      };
    if (route.includes("/artifacts"))
      return {
        artifacts: [
          {
            id: 77,
            name: "candidate-501",
            expired: false,
            size_in_bytes: bytes.length,
            digest: digest(bytes),
            workflow_run: { head_sha: head },
          },
        ],
      };
    throw Error("UNEXPECTED_REQUEST");
  });
  options = {
    root,
    evidence,
    request: api,
    git: (args) =>
      ({
        config: "https://github.com/Djone/suivi-cb.git",
        "rev-parse": head,
        branch: "2.2.0-dev",
        status: "",
      })[args[0]],
    download: async (_s, file) => fs.writeFileSync(file, bytes),
  };
  flow = createCandidateFlow(options);
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
it("imports an exact authenticated CI artifact and preserves its downloadable archive", async () => {
  expect((await flow.inspect()).ready).toBe(true);
  const r = await flow.prepare({ commit: head }, "operator");
  expect(r.task.status).toBe("downloading");
  await flow.wait();
  expect((await flow.status()).task.status).toBe("ready");
  expect(evidence.importBundle).toHaveBeenCalledWith(
    { source: "github", runId: "501" },
    "operator",
    expect.objectContaining({
      artifactDigest: digest(bytes),
      repository: "Djone/suivi-cb",
      commit: head,
    }),
  );
  expect(digest(fs.readFileSync((await flow.archive()).file))).toBe(
    digest(bytes),
  );
});
it("refuses dirty or unmerged work and foreign repositories", async () => {
  for (const [key, value, code] of [
    ["status", " M file", "WORKTREE_DIRTY"],
    ["branch", "work/unreviewed", "MERGE_PR_FIRST"],
    ["config", "https://github.com/other/repo", "WRONG_REPOSITORY"],
  ]) {
    const f = createCandidateFlow({
      ...options,
      git: (a) => (a[0] === key ? value : options.git(a)),
    });
    expect((await f.inspect()).blockers).toContain(code);
    await expect(f.prepare({ commit: head }, "operator")).rejects.toThrow(
      "CANDIDATE_PREREQUISITES_MISSING",
    );
  }
  expect(evidence.importBundle).not.toHaveBeenCalled();
});
it("requires actual mandatory job results and synchronized immutable source", async () => {
  const f = createCandidateFlow({
    ...options,
    request: (r) =>
      r.includes("/jobs") ? Promise.resolve({ jobs: [] }) : api(r),
  });
  expect((await f.inspect()).blockers).toContain("CI_CHECKS_MISSING");
  await expect(
    flow.prepare({ commit: "b".repeat(40) }, "operator"),
  ).rejects.toThrow("GIT_CHANGED_REFRESH");
  const changed = createCandidateFlow({
    ...options,
    request: (r) =>
      r.startsWith("/branches/")
        ? Promise.resolve({ protected: true, commit: { sha: "b".repeat(40) } })
        : api(r),
  });
  expect((await changed.inspect()).blockers).toContain("PUSH_OR_PULL_REQUIRED");
});
it("explains incomplete CI and refuses expired artifacts", async () => {
  for (const [status, conclusion, code] of [
    ["in_progress", null, "CI_RUNNING"],
    ["completed", "failure", "CI_FAILED"],
  ]) {
    const f = createCandidateFlow({
      ...options,
      request: async (r) => {
        const data = await api(r);
        if (data.workflow_runs)
          Object.assign(data.workflow_runs[0], { status, conclusion });
        return data;
      },
    });
    expect((await f.inspect()).blockers).toContain(code);
  }
  const f = createCandidateFlow({
    ...options,
    request: async (r) => {
      const data = await api(r);
      if (data.artifacts) data.artifacts[0].expired = true;
      return data;
    },
  });
  expect((await f.inspect()).blockers).toContain("ARTIFACT_MISSING");
});
it("rejects archive tampering and wrong source before evidence import", async () => {
  const f = createCandidateFlow({
    ...options,
    download: async (_s, file) => fs.writeFileSync(file, "changed"),
  });
  await f.prepare({ commit: head }, "operator");
  await f.wait();
  expect((await f.status()).task.error).toBe("ARTIFACT_DIGEST_MISMATCH");
  bytes = zip([
    {
      name: "manifest.json",
      data: JSON.stringify({
        candidate: "2.2.0-rc.501",
        commit: "b".repeat(40),
        runId: "501",
        status: "QUALIFIED",
      }),
    },
    { name: "images.tar", data: "x" },
    { name: "SHA256SUMS", data: "y" },
  ]);
  await flow.prepare({ commit: head }, "operator");
  await flow.wait();
  expect((await flow.status()).task.error).toBe("ARTIFACT_SOURCE_MISMATCH");
  expect(evidence.importBundle).not.toHaveBeenCalled();
});
it("refuses conflicting staging and does not persist sensitive transport failures", async () => {
  await flow.prepare({ commit: head }, "operator");
  await flow.wait();
  fs.writeFileSync(
    path.join(root, ".cache/ci/github-run-501/candidate-501/images.tar"),
    "changed",
  );
  await flow.prepare({ commit: head }, "operator");
  await flow.wait();
  expect((await flow.status()).task.error).toBe("STAGED_ARTIFACT_CONFLICT");
  const f = createCandidateFlow({
    ...options,
    download: async () => {
      throw Error("sensitive-token-not-for-report");
    },
  });
  await f.prepare({ commit: head }, "operator");
  await f.wait();
  expect(JSON.stringify(await f.status())).not.toContain("sensitive-token");
});
it("prevents concurrent preparations and detects an interrupted backend task", async () => {
  const first = flow.prepare({ commit: head }, "operator");
  await expect(flow.prepare({ commit: head }, "operator")).rejects.toThrow(
    "CANDIDATE_BUSY",
  );
  await first;
  await flow.wait();
  fs.writeFileSync(
    path.join(root, ".cache/ci/candidate-flow.json"),
    JSON.stringify({ status: "downloading", runId: "501" }),
  );
  expect((await createCandidateFlow(options).status()).task.status).toBe(
    "interrupted",
  );
});
it("rejects ZIP traversal, symlinks and duplicate names", async () => {
  for (const entries of [
    [{ name: "NUL", data: "blocked device" }],
    [
      { name: "case.json", data: "x" },
      { name: "CASE.json", data: "y" },
    ],
    [{ name: "../escape", data: "x" }],
    [{ name: "link", data: "target", mode: 0xa000 }],
    [
      { name: "duplicate", data: "x" },
      { name: "duplicate", data: "y" },
    ],
  ]) {
    const file = path.join(root, "test.zip"),
      target = fs.mkdtempSync(path.join(root, "extract-"));
    fs.writeFileSync(file, zip(entries));
    await expect(extractZip(file, target)).rejects.toThrow();
  }
});
it("creates a preproduction-only kit with explicit approval, reviewed code and checksums", async () => {
  const source = path.resolve(__dirname, "../../..");
  for (const n of [
    "nas-preproduction.sh",
    "sqlite-snapshot.cjs",
    "validate-bundle.cjs",
    "guide/prepare-preproduction.sh",
    "guide/apply-preproduction.sh",
    "guide/check-production.sh",
    "guide/test-rollback.sh",
    "guide/check-backup.sh",
  ]) {
    const p = path.join(root, "deploy-controller", n);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.copyFileSync(path.join(source, "deploy-controller", n), p);
  }
  for (const n of ["common.cjs", "contracts.cjs"]) {
    fs.mkdirSync(path.join(root, "scripts/ci"), { recursive: true });
    fs.copyFileSync(
      path.join(source, "scripts/ci", n),
      path.join(root, "scripts/ci", n),
    );
  }
  const dossier = {
    identity: "id",
    revision: 3,
    manifest: {
      candidate: "2.2.0-rc.501",
      commit: head,
      runId: "501",
      archiveSha256: "c".repeat(64),
    },
  };
  const kit = createNasKit({
    root,
    evidence: { read: () => ({ dossier, readyForPreproduction: true }) },
  });
  await expect(
    kit({ identity: "id", revision: 3 }, "operator"),
  ).rejects.toThrow("PREPRODUCTION_KIT_BLOCKED");
  const a = await kit(
    { identity: "id", revision: 3, confirmPreproduction: true },
    "operator",
  );
  const listing = execFileSync("tar", ["-tzf", a.file], { encoding: "utf8" });
  for (const n of [
    "prepare-preproduction.sh",
    "test-rollback.sh",
    "SHA256SUMS",
  ])
    expect(listing).toContain("nas-kit/" + n);
  const dir = path.join(path.dirname(a.file), "nas-kit");
  expect(
    JSON.parse(fs.readFileSync(path.join(dir, "approval.json"))).target,
  ).toBe("preproduction");
  expect(
    fs.readFileSync(path.join(dir, "test-rollback.sh"), "utf8"),
  ).not.toContain("/volume1/docker/suivi-cb/data");
});

it("downloads only from approved HTTPS storage without forwarding GitHub authorization", async () => {
  const fetchSpy = jest
    .spyOn(global, "fetch")
    .mockResolvedValue(new Response(bytes));
  try {
    flow = createCandidateFlow({
      ...options,
      download: undefined,
      request: (route, opts) =>
        opts?.raw
          ? Promise.resolve(
              new Response(null, {
                status: 302,
                headers: {
                  location:
                    "https://test.blob.core.windows.net/artifact?signature=test",
                },
              }),
            )
          : api(route),
    });
    await flow.prepare({ commit: head }, "operator");
    await flow.wait();
    expect((await flow.status()).task.status).toBe("ready");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][1].headers).toBeUndefined();
  } finally {
    fetchSpy.mockRestore();
  }
});
it("refuses untrusted artifact redirect hosts before any outbound storage request", async () => {
  const fetchSpy = jest.spyOn(global, "fetch");
  try {
    flow = createCandidateFlow({
      ...options,
      download: undefined,
      request: (route, opts) =>
        opts?.raw
          ? Promise.resolve(
              new Response(null, {
                status: 302,
                headers: { location: "https://untrusted.example/artifact" },
              }),
            )
          : api(route),
    });
    await flow.prepare({ commit: head }, "operator");
    await flow.wait();
    expect((await flow.status()).task.error).toBe("UNSAFE_ARTIFACT_REDIRECT");
    expect(fetchSpy).not.toHaveBeenCalled();
  } finally {
    fetchSpy.mockRestore();
  }
});
