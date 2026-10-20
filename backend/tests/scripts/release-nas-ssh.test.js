const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { createNasSsh } = require("../../services/release-nas-ssh");
let root, calls;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "suivi-ssh-test-"));
  calls = [];
  fs.mkdirSync(path.join(root, "deploy-controller/guide"), { recursive: true });
  fs.copyFileSync(
    path.resolve(
      __dirname,
      "../../../deploy-controller/guide/install-release-ssh.sh",
    ),
    path.join(root, "deploy-controller/guide/install-release-ssh.sh"),
  );
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});
function mockRun(program, args) {
  calls.push({ program, args });
  if (program === "whoami") return '"user","S-1-5-21-123"';
  if (program === "ssh-keygen") {
    const key = args[args.indexOf("-f") + 1];
    fs.writeFileSync(key, "test-key-placeholder");
    fs.writeFileSync(
      key + ".pub",
      "ssh-ed25519 AAAAtest suivi-cb-release-local",
    );
  }
  if (program === "ssh") return "SUIVI_CB_SSH_READY\n";
  return "";
}
it("requires confirmation and creates a dedicated key only once without returning the private key", () => {
  const ssh = createNasSsh({ root, run: mockRun });
  expect(() => ssh.create({})).toThrow("CONFIRMATION");
  expect(ssh.status().configured).toBe(false);
  const r = ssh.create({ confirm: true });
  expect(r.publicKey).toContain("ssh-ed25519");
  expect(JSON.stringify(r)).not.toContain("placeholder");
  ssh.create({ confirm: true });
  expect(calls.filter((x) => x.program === "ssh-keygen")).toHaveLength(1);
  expect(ssh.status().productionEnabled).toBe(false);
});
it("uses fixed batch SSH arguments, strict host checking and the forced probe command", () => {
  const ssh = createNasSsh({ root, run: mockRun });
  expect(() => ssh.probe()).toThrow("SSH_KEY_REQUIRED");
  ssh.create({ confirm: true });
  expect(ssh.probe().connected).toBe(true);
  const args = calls.find((x) => x.program === "ssh").args;
  expect(args).toContain("StrictHostKeyChecking=yes");
  expect(args).toContain("BatchMode=yes");
  expect(args[args.length - 1]).toBe("suivi-cb-probe");
  const script = ssh.installer();
  expect(script).not.toContain("__PUBLIC_KEY__");
  expect(script).toContain("no-port-forwarding");
  expect(script).toContain("SSH_KEY_INSTALLED_PROBE_ONLY");
  expect(script).not.toContain("NOPASSWD:");
  expect(script).not.toContain("/etc/sudoers.d");
});
it("refuses unexpected remote output and masks remote errors", () => {
  const ssh = createNasSsh({ root, run: mockRun });
  ssh.create({ confirm: true });
  for (const run of [
    () => "unexpected",
    () => {
      throw Error("sensitive stderr");
    },
  ])
    expect(() => createNasSsh({ root, run }).probe()).toThrow(
      "SSH_CONNECTION_OR_INSTALLATION_REQUIRED",
    );
});

it("binds the remote plan to the current dossier and rejects stale or foreign staging", () => {
  const d = {
    identity: "id",
    revision: 2,
    manifest: {
      candidate: "2.2.0-rc.501",
      commit: "a".repeat(40),
      runId: "501",
    },
  };
  let ready = true;
  const evidence = {
    read: () => ({ dossier: d, readyForPreproduction: ready }),
  };
  const ssh = createNasSsh({ root, run: mockRun, evidence });
  ssh.create({ confirm: true });
  expect(() => ssh.plan({ identity: "old", revision: 2 })).toThrow(
    "PREPRODUCTION_PLAN_BLOCKED",
  );
  ready = false;
  expect(() => ssh.plan({ identity: "id", revision: 2 })).toThrow(
    "PREPRODUCTION_PLAN_BLOCKED",
  );
  ready = true;
  const run = () =>
    "Target=preproduction Candidate=2.2.0-rc.501 Commit=" +
    "a".repeat(40) +
    " Run=501 Port=127.0.0.1:4205\nPLAN_ONLY: no application service changed.\n";
  const connected = createNasSsh({ root, run, evidence });
  expect(connected.plan({ identity: "id", revision: 2 }).planOnly).toBe(true);
  d.manifest.commit = "b".repeat(40);
  expect(() => connected.plan({ identity: "id", revision: 2 })).toThrow(
    "NAS_STAGED_CANDIDATE_MISMATCH",
  );
});
