// This runner accepts image references only: never a NAS URL, host database or credentials.
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  crypto = require("node:crypto"),
  net = require("node:net");
const { spawnSync, spawn } = require("node:child_process");
let interrupted = false,
  activeChild;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    interrupted = true;
    activeChild?.kill("SIGTERM");
  });
function browserTests(args, env) {
  return new Promise((resolve) => {
    let stdout = "";
    activeChild = spawn(process.execPath, args, {
      cwd: ROOT,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    activeChild.stdout.on("data", (b) => (stdout += b));
    activeChild.stderr.on("data", () => {});
    const timer = setTimeout(() => activeChild?.kill("SIGTERM"), 420000);
    activeChild.on("error", () => {
      clearTimeout(timer);
      activeChild = undefined;
      resolve({ status: 1, stdout });
    });
    activeChild.on("close", (code) => {
      clearTimeout(timer);
      activeChild = undefined;
      resolve({ status: code, stdout });
    });
  });
}

const ROOT = path.resolve(__dirname, "..");
process.chdir(ROOT);
const id =
  "suivi-e2e-" + Date.now() + "-" + crypto.randomBytes(4).toString("hex");
const output = path.join(ROOT, ".cache", "e2e", id);
fs.mkdirSync(output, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "suivi-e2e-"));
const password = crypto.randomBytes(24).toString("base64url"),
  adminPassword = crypto.randomBytes(24).toString("base64url");
const containers = [],
  volumes = [],
  networks = [];
const keepAlive = setInterval(() => {}, 1000);
let result = {
  schemaVersion: 1,
  run: id,
  status: "FAIL",
  startedAt: new Date().toISOString(),
  checks: [],
  limitations: [
    "Synthetic data only",
    "Keycloak HTTP on loopback; backend NODE_ENV=test retains JWT authorization; NAS HTTPS/proxy/OTP remain human acceptance",
    "No browser trace, screenshot, video, tokens or passwords retained",
  ],
};
function ensure(condition, code) { if (!condition) throw Error(code); }
function command(program, args, timeout = 180000) {
  const r = spawnSync(program, args, {
    cwd: ROOT,
    encoding: "utf8",
    timeout,
    maxBuffer: 16000000,
  });
  if (r.status !== 0) throw Error("COMMAND_FAILED: " + program + " " + args[0]);
  return r.stdout.trim();
}
function docker(...args) {
  return command("docker", args);
}
function resource(kind, name) {
  const label = docker(
    kind,
    "inspect",
    "--format",
    '{{index .Labels "suivi.e2e.run"}}',
    name,
  );
  if (label !== id) throw Error("RESOURCE_OWNERSHIP_MISMATCH");
}
async function port() {
  const s = net.createServer();
  await new Promise((ok, no) => s.listen(0, "127.0.0.1", ok).once("error", no));
  const p = s.address().port;
  await new Promise((ok) => s.close(ok));
  return p;
}
async function wait(url) {
  for (let i = 0; i < 90; i++) {
    if (interrupted) throw Error("INTERRUPTED");
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1500) })).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw Error("READINESS_TIMEOUT");
}
function create(name, args, image, cmd = []) {
  containers.push(name);
  docker(
    "create",
    "--pull=never",
    "--name",
    name,
    "--label",
    "suivi.e2e.run=" + id,
    ...args,
    image,
    ...cmd,
  );
}
async function run() {
  try {
    const args = process.argv.slice(2);
    if (
      args.some(
        (a) =>
          !a.startsWith("--backend-image=") &&
          !a.startsWith("--frontend-image=") &&
          a !== "--build",
      )
    )
      throw Error("UNSUPPORTED_OPTION");
    const option = (key) =>
      args.find((a) => a.startsWith(key + "="))?.slice(key.length + 1);
    let backend = option("--backend-image"),
      frontend = option("--frontend-image");
    if (args.includes("--build")) {
      if (backend || frontend) throw Error("BUILD_AND_IMAGE_OPTIONS_EXCLUSIVE");
      backend = id + "-backend";
      frontend = id + "-frontend";
      console.log("Building isolated application images");
      docker("build", "-f", "Dockerfile.backend", "-t", backend, ".");
      docker(
        "build",
        "-f",
        "Dockerfile.frontend",
        "--build-arg",
        "APP_VERSION=2.2.0-rc.900",
        "--build-arg",
        "APP_BUILD_TIME=" + new Date().toISOString(),
        "-t",
        frontend,
        ".",
      );
    }
    if (!backend || !frontend) throw Error("USE_BUILD_OR_BOTH_IMAGE_OPTIONS");
    const refs = [backend, frontend, "quay.io/keycloak/keycloak:26.7.4"];
    const inspect = refs.map(
      (ref) => JSON.parse(docker("image", "inspect", ref))[0],
    );
    result.images = inspect.map((x, i) => ({
      reference: refs[i],
      id: x.Id,
      repoDigests: x.RepoDigests,
      user: x.Config.User,
      sourceLabel:
        x.Config.Labels?.["org.opencontainers.image.revision"] || null,
    }));
    result.testFiles = Object.fromEntries(
      [
        "scripts/test-e2e.cjs",
        ...fs
          .readdirSync("tests/e2e")
          .filter((f) => f.endsWith(".cjs"))
          .map((f) => "tests/e2e/" + f),
      ].map((f) => [
        f,
        crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex"),
      ]),
    );
    result.source = {
      commit: command("git", ["rev-parse", "HEAD"]),
      dirty: !!command("git", ["status", "--porcelain"]),
      diffSha256: crypto
        .createHash("sha256")
        .update(command("git", ["diff", "HEAD"]))
        .digest("hex"),
    };
    const edge = id + "-edge";
    networks.push(edge);
    docker("network", "create", "--label", "suivi.e2e.run=" + id, edge);
    const network = id + "-network",
      volume = id + "-data",
      kc = id + "-keycloak",
      back = id + "-backend",
      web = id + "-frontend";
    networks.push(network);
    docker(
      "network",
      "create",
      "--internal",
      "--label",
      "suivi.e2e.run=" + id,
      network,
    );
    volumes.push(volume);
    docker("volume", "create", "--label", "suivi.e2e.run=" + id, volume);
    const kp = await port(),
      wp = await port();
    const kcUrl = "http://127.0.0.1:" + kp,
      webUrl = "http://127.0.0.1:" + wp;
    const realm = {
      realm: "e2e",
      enabled: true,
      sslRequired: "none",
      accessTokenLifespan: 15,
      ssoSessionIdleTimeout: 300,
      roles: { realm: [{ name: "app-user" }] },
      clients: [
        {
          clientId: "suivi-cb-web",
          publicClient: true,
          enabled: true,
          standardFlowEnabled: true,
          directAccessGrantsEnabled: true,
          redirectUris: [webUrl + "/home", webUrl + "/silent-check-sso.html"],
          webOrigins: [webUrl],
          attributes: {
            "pkce.code.challenge.method": "S256",
            "post.logout.redirect.uris": webUrl + "/login",
          },
          protocolMappers: [
            ...["suivi-cb-api", "account"].map((a) => ({
              name: "aud-" + a,
              protocol: "openid-connect",
              protocolMapper: "oidc-audience-mapper",
              config: {
                "included.custom.audience": a,
                "access.token.claim": "true",
              },
            })),
            {
              name: "realm-roles",
              protocol: "openid-connect",
              protocolMapper: "oidc-usermodel-realm-role-mapper",
              config: {
                multivalued: "true",
                "claim.name": "realm_access.roles",
                "jsonType.label": "String",
                "access.token.claim": "true",
              },
            },
          ],
        },
      ],
      users: ["allowed", "denied", "revoked", "session"].map((username) => ({
        username,
        enabled: true,
        emailVerified: true,
        email: username + "@example.invalid",
        firstName: "Synthetic",
        lastName: "Fixture",
        realmRoles: username === "denied" ? [] : ["app-user"],
        clientRoles: { account: ["manage-account", "view-profile"] },
        credentials: [{ type: "password", value: password, temporary: false }],
      })),
    };
    const adminEnv = path.join(tmp, "admin.env");
    fs.writeFileSync(
      adminEnv,
      "KC_BOOTSTRAP_ADMIN_PASSWORD=" + adminPassword + "\n",
      { mode: 0o600 },
    );
    const realmFile = path.join(tmp, "realm.json");
    fs.writeFileSync(realmFile, JSON.stringify(realm), { mode: 0o644 });
    create(
      kc,
      [
        "--entrypoint",
        "sh",
        "--network",
        network,
        "--network-alias",
        "keycloak",
        "--memory",
        "768m",
        "-p",
        "127.0.0.1:" + kp + ":8080",
        "-e",
        "KC_BOOTSTRAP_ADMIN_USERNAME=fixture-admin",
        "--env-file",
        adminEnv,
        "-e",
        "KC_HOSTNAME=" + kcUrl,
        "-e",
        "JAVA_OPTS_KC_HEAP=-Xms128m -Xmx384m",
      ],
      inspect[2].Id,
      [
        "-c",
        "mkdir -p /opt/keycloak/data/import && cp /tmp/e2e-realm.json /opt/keycloak/data/import/realm.json && exec /opt/keycloak/bin/kc.sh start-dev --import-realm",
      ],
    );
    docker("cp", realmFile, kc + ":/tmp/e2e-realm.json");
    docker("network", "connect", edge, kc);
    docker("start", kc);
    await wait(kcUrl + "/realms/e2e/.well-known/openid-configuration");
    const init = id + "-init";
    create(
      init,
      [
        "--network",
        "none",
        "--user",
        "0",
        "--mount",
        "type=volume,source=" + volume + ",target=/app/data",
      ],
      inspect[0].Id,
      [
        "node",
        "-e",
        "const fs=require('fs');fs.chownSync('/app/data',1028,100);fs.writeFileSync('/app/data/.e2e-owned','synthetic');",
      ],
    );
    docker("start", "-a", init);
    if (docker("inspect", "--format", "{{.State.ExitCode}}", init) !== "0")
      throw Error("VOLUME_INIT_FAILED");
    create(
      back,
      [
        "--network",
        network,
        "--network-alias",
        "backend",
        "--memory",
        "256m",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges",
        "--mount",
        "type=volume,source=" + volume + ",target=/app/data",
        "-e",
        "NODE_ENV=test",
        "-e",
        "PORT_BACK=3001",
        "-e",
        "DB_PATH=/app/data/database.db",
        "-e",
        "DOCUMENTATION_DISABLED=true",
        "-e",
        "RELEASE_PROCESS_DISABLED=true",
        "-e",
        "KEYCLOAK_URL=" + kcUrl,
        "-e",
        "KEYCLOAK_REALM=e2e",
        "-e",
        "KEYCLOAK_CLIENT_ID=suivi-cb-web",
        "-e",
        "KEYCLOAK_JWKS_URL=http://keycloak:8080/realms/e2e/protocol/openid-connect/certs",
        "-e",
        "KEYCLOAK_ACCOUNT_URL=http://keycloak:8080",
      ],
      inspect[0].Id,
    );
    docker("start", back);
    create(
      web,
      [
        "--network",
        network,
        "--memory",
        "128m",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges",
        "--sysctl",
        "net.ipv4.ip_unprivileged_port_start=1024",
        "-p",
        "127.0.0.1:" + wp + ":8080",
      ],
      inspect[1].Id,
    );
    docker("network", "connect", edge, web);
    docker("start", web);
    await wait(webUrl + "/api/auth/config");
    for (let i = 0; i < 60; i++) {
      try {
        docker(
          "exec",
          back,
          "node",
          "-e",
          "fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1))",
        );
        break;
      } catch (e) {
        if (i === 59) throw e;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    // Fresh migration creates no host fixtures. Seed only this owned volume via the running application image.
    docker(
      "exec",
      back,
      "node",
      "-e",
      "const d=require('./config/db');d.serialize(()=>{d.run(\"UPDATE accounts SET name=CASE id WHEN 1 THEN 'E2E_ACCOUNT_A' WHEN 2 THEN 'E2E_ACCOUNT_B' END WHERE id IN (1,2)\");d.close(e=>{if(e)process.exitCode=1})});",
    );
    docker(
      "exec",
      "--user",
      "0",
      back,
      "node",
      "-e",
      "const fs=require('fs');fs.writeFileSync('/app/config/accounts.config.json',JSON.stringify({accounts:[{accountId:1,initialBalance:0},{accountId:2,initialBalance:0}]}));fs.writeFileSync('/app/config/account.config.json',JSON.stringify({initialBalance:0,accountName:'Synthetic',currency:'EUR'}));",
    );
    console.log("Running synthetic API and Chromium journeys");
    const cli = require.resolve("@playwright/test/cli");
    const r = await browserTests(
      [cli, "test", "--config", "tests/e2e/playwright.config.cjs"],
      {
        ...process.env,
        E2E_WEB: webUrl,
        E2E_KC: kcUrl,
        E2E_PASSWORD: password,
        E2E_ADMIN_PASSWORD: adminPassword,
        E2E_OUTPUT: output,
      },
    );
    if (interrupted) throw Error("INTERRUPTED");
    console.log(r.stdout || "");
    if (r.status !== 0) throw Error("JOURNEYS_FAILED");
    require("../tests/e2e/safety.cjs").requiredReport(
      JSON.parse(fs.readFileSync(path.join(output, "tests.json"))),
    );
    docker("restart", back);
    for (let i = 0; i < 60; i++) {
      try {
        docker(
          "exec",
          back,
          "node",
          "-e",
          "const d=require('./config/db');d.get(\"SELECT count(*) n FROM transactions WHERE description='E2E_PERSISTENCE'\",(e,r)=>{if(e||r.n!==1)process.exitCode=1;d.close()})",
        );
        break;
      } catch (e) {
        if (i === 59) throw e;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    result.checks.push("persistence after backend restart");
    result.status = "PASS";
  } catch (e) {
    result.failureCode = e.message.startsWith("COMMAND_FAILED")
      ? e.message
      : e.message.replace(/[^A-Z_]/g, "").slice(0, 80);
    console.error(result.failureCode);
    process.exitCode = 1;
  } finally {
    const failures = [];
    for (const name of containers.reverse())
      try {
        const label = docker(
          "inspect",
          "--format",
          '{{index .Config.Labels "suivi.e2e.run"}}',
          name,
        );
        ensure(label === id, "ownership");
        docker("rm", "-f", name);
      } catch {
        failures.push("container:" + name);
      }
    for (const name of volumes)
      try {
        resource("volume", name);
        docker("volume", "rm", name);
      } catch {
        failures.push("volume:" + name);
      }
    for (const name of networks)
      try {
        resource("network", name);
        docker("network", "rm", name);
      } catch {
        failures.push("network:" + name);
      }
    clearInterval(keepAlive);
    try {
      ensure(path.dirname(path.resolve(tmp)) === path.resolve(os.tmpdir()) && path.basename(tmp).startsWith("suivi-e2e-"), "TEMP_PATH_MISMATCH");
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      failures.push("temporary-fixtures");
    }
    try {
      const browserOutput = path.resolve(output, "browser");
      ensure(path.dirname(browserOutput) === path.resolve(output), "OUTPUT_PATH_MISMATCH");
      fs.rmSync(browserOutput, { recursive: true, force: true });
    } catch {
      failures.push("browser-artifacts");
    }
    result.cleanup = { status: failures.length ? "FAIL" : "PASS", failures };
    if (failures.length) {
      result.status = "FAIL";
      process.exitCode = 1;
    }
    result.finishedAt = new Date().toISOString();
    fs.writeFileSync(
      path.join(output, "qualification.json"),
      JSON.stringify(result, null, 2),
    );
    console.log("Report: " + output);
    console.log("Overall: " + result.status);
  }
}
run();
