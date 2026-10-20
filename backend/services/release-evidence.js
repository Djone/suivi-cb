const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const QUALITY = [
  "lint",
  "typecheck",
  "test:ci:policy",
  "test:candidate",
  "test:e2e:safety",
  "backend-unit-coverage",
  "backend-test:auth",
  "backend-test:security",
  "frontend-unit",
  "dependency-gates",
];
const MANUAL = {
  "source-review": [
    "development",
    "Provenance CI, commit retenu, périmètre et notes relus",
  ],
  "nas-identity": [
    "preproduction",
    "Images réellement importées sur NAS : architecture et identités conformes",
  ],
  "nas-auth": [
    "preproduction",
    "NAS : 401/403/200, audience, refresh, OTP, déconnexion et accès refusé",
  ],
  "nas-business": [
    "preproduction",
    "NAS : opérations, virements, récurrences, rapprochement et persistance",
  ],
  "nas-recovery": [
    "preproduction",
    "NAS : migrations, sauvegarde et rollback conservant les écritures",
  ],
  "operations-rights": [
    "preproduction",
    "Sauvegarde publiée et USB, restauration et droits GitHub/NAS vérifiés",
  ],
  "preproduction-approval": [
    "preproduction",
    "Approbation explicite des images testées en préproduction",
  ],
  "production-approval": [
    "production",
    "Approbation explicite de promotion des mêmes images",
  ],
  "production-deployment": [
    "production",
    "Promotion réalisée après sauvegarde cohérente, sans rebuild",
  ],
  "production-smoke": [
    "production",
    "Santé, version, parcours métier et sauvegarde après livraison",
  ],
  "git-publication": [
    "production",
    "Publication Git, tag, release et cycle suivant vérifiés",
  ],
};
const containsSecret = (v) =>
  /-----BEGIN [A-Z ]*PRIVATE KEY-----|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(
    v,
  );
const digest = (v) => crypto.createHash("sha256").update(v).digest("hex");
const shaFile = (p) =>
  new Promise((resolve, reject) => {
    const h = crypto.createHash("sha256"),
      s = fs.createReadStream(p);
    s.on("data", (c) => h.update(c));
    s.on("error", reject);
    s.on("end", () => resolve(h.digest("hex")));
  });
function json(p) {
  const st = fs.lstatSync(p);
  if (!st.isFile() || st.isSymbolicLink() || st.size > 8 * 1024 * 1024)
    throw Error("INVALID_PROOF_FILE");
  return JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
}
function identity(m) {
  return digest(
    JSON.stringify([
      m.candidate,
      m.commit,
      m.archiveSha256,
      m.images.backend.configDigest,
      m.images.frontend.configDigest,
      m.images.backend.registryRef || null,
      m.images.frontend.registryRef || null,
    ]),
  );
}
function createReleaseEvidence({
  root = path.resolve(__dirname, "../.."),
  store = path.join(root, "data/release/evidence"),
  repository,
} = {}) {
  let busy = false;
  const current = path.join(store, "current.json");
  const repo =
    repository ||
    (() => {
      try {
        return {
          commit: execFileSync("git", ["rev-parse", "HEAD"], {
            cwd: root,
            encoding: "utf8",
          }).trim(),
          clean: !execFileSync(
            "git",
            ["status", "--porcelain", "--untracked-files=all"],
            { cwd: root, encoding: "utf8" },
          ).trim(),
        };
      } catch {
        return { commit: null, clean: false };
      }
    });
  function load() {
    return fs.existsSync(current) ? json(current) : null;
  }
  function archiveDossier(d) {
    const history = path.join(store, "history");
    fs.mkdirSync(history, { recursive: true, mode: 0o700 });
    const file = path.join(history, d.identity + "-" + d.revision + ".json");
    if (fs.existsSync(file)) {
      if (digest(JSON.stringify(json(file))) !== digest(JSON.stringify(d)))
        throw Error("HISTORY_CONFLICT");
      return;
    }
    fs.writeFileSync(file, JSON.stringify(d, null, 2), {
      mode: 0o600,
      flag: "wx",
    });
  }
  function save(d) {
    fs.mkdirSync(store, { recursive: true, mode: 0o700 });
    const tmp = path.join(store, crypto.randomUUID() + ".tmp");
    fs.writeFileSync(tmp, JSON.stringify(d, null, 2) + "\n", {
      mode: 0o600,
      flag: "wx",
    });
    try {
      fs.renameSync(tmp, current);
    } finally {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    }
  }
  function evaluate(d, now = new Date()) {
    const blockers = [],
      checks = [];
    const add = (id, label, passed, stage = "development") => {
      checks.push({
        id,
        label,
        status: passed ? "PASS" : "MISSING_OR_FAILED",
        stage,
      });
      if (!passed) blockers.push({ id, label, stage });
    };
    const state = repo();
    if (!d)
      return {
        dossier: null,
        checks: [],
        blockers: [
          {
            id: "candidate",
            label: "Importer une candidate et ses preuves",
            stage: "development",
          },
        ],
        repository: state,
        readyForPreproduction: false,
        readyForProduction: false,
        canClose: false,
        publicationEnabled: false,
      };
    const m = d.manifest;
    add(
      "scope",
      "Périmètre figé et notes de release renseignées",
      Boolean(d.scope?.frozen && d.scope.summary && d.scope.releaseNotes),
    );
    add("repository", "Dépôt de travail propre", state.clean === true);
    add(
      "source-current",
      "Le commit local correspond au commit de la candidate",
      state.commit === m.commit,
    );
    for (const c of d.automated) add(c.id, c.label, c.status === "PASS");
    let policy;
    try {
      policy = json(
        path.join(
          root,
          "docs/audit/2026-10-15/dependency-risk-acceptance.json",
        ),
      );
    } catch {
      policy = {};
    }
    const deadline = Math.min(
      Date.parse(m.exceptionReviewBy + "T23:59:59.999Z"),
      Date.parse(policy.reviewBy + "T23:59:59.999Z"),
    );
    add(
      "exceptions",
      "Exceptions documentées et non expirées",
      policy.accepted === true &&
        Number.isFinite(deadline) &&
        now.getTime() <= deadline,
    );
    for (const [id, [stage, label]] of Object.entries(MANUAL))
      add(
        id,
        label,
        Boolean(
          d.validations[id]?.approved &&
          d.validations[id].identity === d.identity,
        ),
        stage,
      );
    add(
      "release-plan",
      "Version suivante du cycle de développement enregistrée",
      Boolean(
        d.releasePlan?.identity === d.identity && d.releasePlan?.nextDevVersion,
      ),
      "production",
    );
    const development = blockers.filter((x) => x.stage === "development");
    const preprod = blockers.filter((x) => x.stage === "preproduction");
    add(
      "registry",
      "Références GHCR immuables disponibles",
      m.status === "PUBLISHED" &&
        ["backend", "frontend"].every((k) =>
          /^ghcr\.io\/djone\/suivi-cb-(backend|frontend)@sha256:[a-f0-9]{64}$/.test(
            m.images[k].registryRef || "",
          ),
        ),
      "production",
    );
    add(
      "publication-lock",
      "Publications désactivées à la demande du mainteneur",
      false,
      "production",
    );
    return {
      dossier: d,
      reservations: [
        {
          component: "braces@3.0.3",
          advisory: "GHSA-vfj7-8cjw-p6xm",
          technicallyFixed: false,
          reviewBy: Number.isFinite(deadline)
            ? new Date(deadline).toISOString().slice(0, 10)
            : null,
          owner:
            typeof policy.reviewOwner === "string"
              ? policy.reviewOwner
              : "Project maintainer",
          justification:
            typeof policy.scope === "string"
              ? policy.scope
              : "Development tooling only",
          productionApproval: false,
        },
        {
          component: "backup-retention-usb-monitoring",
          targetVersion: "2.3.0",
          plannedFor: "2026-11-15",
          status: "deferred-not-validated",
          retention: "7 daily / 4 weekly",
          usbAlertHours: 36,
        },
      ],
      repository: state,
      checks,
      blockers,
      readyForPreproduction: development.length === 0,
      readyForProduction:
        development.length === 0 &&
        preprod.length === 0 &&
        !blockers.some((x) =>
          ["registry", "publication-lock", "release-plan"].includes(x.id),
        ),
      canClose: blockers.length === 0,
      publicationEnabled: false,
    };
  }
  async function mutate(fn) {
    if (busy) throw Error("EVIDENCE_BUSY");
    busy = true;
    try {
      return await fn();
    } finally {
      busy = false;
    }
  }
  async function importBundle(input, actor, githubProvenance) {
    return mutate(async () => {
      if (!["local", "github"].includes(input.source))
        throw Error("INVALID_IMPORT_SOURCE");
      if (
        input.source === "github" &&
        !/^[1-9][0-9]{0,19}$/.test(String(input.runId || ""))
      )
        throw Error("INVALID_RUN_ID");
      const dir =
        input.source === "local"
          ? path.join(root, ".cache/ci/package")
          : path.join(
              root,
              ".cache/ci",
              "github-run-" + input.runId,
              "candidate-" + input.runId,
            );
      // Resolve every parent: a symlink/junction cannot escape the approved staging directory.
      const cache = fs.realpathSync(path.join(root, ".cache/ci"));
      if (cache !== path.join(fs.realpathSync(root), ".cache/ci"))
        throw Error("UNSAFE_IMPORT_PATH");
      const real = fs.realpathSync(dir);
      if (real !== cache && !real.startsWith(cache + path.sep))
        throw Error("UNSAFE_IMPORT_PATH");
      const manifest = json(path.join(real, "manifest.json"));
      const { validate } = require("../../scripts/ci/contracts.cjs");
      validate(manifest, { registered: manifest.status === "PUBLISHED" });
      if (
        !/^(?:[1-9][0-9]{0,19}|local)$/.test(String(manifest.runId)) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(manifest.exceptionReviewBy || "")
      )
        throw Error("INVALID_MANIFEST_METADATA");
      if (
        input.source === "github" &&
        String(manifest.runId) !== String(input.runId)
      )
        throw Error("SOURCE_RUN_MISMATCH");
      const inventoryFile = path.join(real, "SHA256SUMS");
      const inventoryStat = fs.lstatSync(inventoryFile);
      if (
        !inventoryStat.isFile() ||
        inventoryStat.isSymbolicLink() ||
        inventoryStat.size > 262144
      )
        throw Error("INVALID_INVENTORY");
      const inventory = fs.readFileSync(path.join(real, "SHA256SUMS"), "utf8");
      const files = new Map();
      for (const line of inventory.trim().split(/\r?\n/)) {
        const match = /^([a-f0-9]{64})  ([a-zA-Z0-9][a-zA-Z0-9._-]*)$/.exec(
          line,
        );
        if (!match || match[2] === "SHA256SUMS" || files.has(match[2]))
          throw Error("INVALID_INVENTORY");
        files.set(match[2], match[1]);
      }
      if (
        !files.has("manifest.json") ||
        !files.has("images.tar") ||
        files.get("images.tar") !== manifest.archiveSha256
      )
        throw Error("INCOMPLETE_INVENTORY");
      for (const name of fs.readdirSync(real))
        if (name !== "SHA256SUMS" && !files.has(name))
          throw Error("UNLISTED_FILE");
      let archive = false;
      for (const [name, sha] of files) {
        const file = path.join(real, name);
        if (name === "images.tar" && !fs.existsSync(file)) continue;
        const st = fs.lstatSync(file);
        if (
          !st.isFile() ||
          st.isSymbolicLink() ||
          (await shaFile(file)) !== sha
        )
          throw Error("CHECKSUM_FAILED");
        if (name === "images.tar") archive = true;
      }
      const read = (n) =>
        files.has(n + ".json") ? json(path.join(real, n + ".json")) : null;
      const q = read("quality"),
        e = read("e2e-qualification"),
        tests = read("e2e-tests"),
        rollback = read("rollback"),
        kc = read("keycloak"),
        inspection = read("inspection");
      const automated = [];
      const add = (id, label, pass) =>
        automated.push({
          id,
          label,
          status: pass ? "PASS" : "MISSING_OR_FAILED",
        });
      add(
        "qualified",
        "Manifeste qualifié",
        ["QUALIFIED", "PUBLISHED"].includes(manifest.status),
      );
      add("archive", "Archive complète et empreintes vérifiées", archive);
      add(
        "quality",
        "Rapport qualité : source propre et tous les contrôles",
        q?.status === "PASS" &&
          q.sourceDirty === false &&
          q.commit === manifest.commit &&
          String(q.runId) === String(manifest.runId) &&
          QUALITY.every((n) =>
            q.checks?.some((c) => c.name === n && c.status === "PASS"),
          ),
      );
      add(
        "e2e",
        "Parcours API/navigateur et nettoyage",
        e?.status === "PASS" &&
          e.cleanup?.status === "PASS" &&
          e.source?.dirty === false &&
          e.source.commit === manifest.commit &&
          e.images?.[0]?.id === manifest.images.backend.localId &&
          e.images?.[1]?.id === manifest.images.frontend.localId &&
          tests?.status === "passed" &&
          tests.tests?.length >= 8 &&
          tests.tests.every((t) => t.status === "passed"),
      );
      add(
        "rollback",
        "Migrations et rollback : images exactes",
        rollback?.status === "PASS" &&
          rollback.backend === manifest.images.backend.localId &&
          rollback.frontend === manifest.images.frontend.localId,
      );
      add(
        "keycloak",
        "Keycloak : PKCE, OTP, audience, refresh et logout",
        kc?.status === "PASS" && kc.checks?.length >= 8,
      );
      add(
        "inspection",
        "Inspection de l’archive et images non privilégiées",
        inspection?.archiveSha256 === manifest.archiveSha256 &&
          ["backend", "frontend"].every((k) =>
            inspection.images?.some(
              (i) =>
                i.configDigest === manifest.images[k].configDigest &&
                i.user === manifest.images[k].user &&
                Array.isArray(i.sensitivePaths) &&
                !i.sensitivePaths.length &&
                Array.isArray(i.sourceDifferences) &&
                !i.sourceDifferences.length,
            ),
          ),
      );
      for (const k of ["source", "backend", "frontend"]) {
        const scan = read(k + "-scan");
        add(
          k + "-scan",
          "Scan " + k,
          scan?.status === "PASS" &&
            scan.commit === manifest.commit &&
            Array.isArray(scan.vulnerabilities) &&
            !scan.vulnerabilities.length &&
            Array.isArray(scan.secrets) &&
            !scan.secrets.length &&
            (k === "source" ||
              scan.configDigest === manifest.images[k].configDigest),
        );
      }
      for (const k of ["backend", "frontend"]) {
        const sbom = read(k + ".cdx");
        add(
          k + "-sbom",
          "SBOM " + k,
          sbom?.bomFormat === "CycloneDX" &&
            Array.isArray(sbom.components) &&
            sbom.components.length > 0,
        );
      }
      if (
        githubProvenance &&
        (githubProvenance.repository !== "Djone/suivi-cb" ||
          githubProvenance.runId !== String(manifest.runId) ||
          githubProvenance.commit !== manifest.commit ||
          !/^sha256:[a-f0-9]{64}$/.test(githubProvenance.artifactDigest) ||
          !/^[1-9][0-9]*$/.test(githubProvenance.artifactId))
      )
        throw Error("GITHUB_PROVENANCE_MISMATCH");
      const old = load(),
        id = identity(manifest),
        proofFingerprint = digest(inventory);
      const same =
        old?.identity === id && old?.proofFingerprint === proofFingerprint;
      const d = {
        schema: 1,
        revision: (old?.revision || 0) + 1,
        identity: id,
        proofFingerprint,
        manifest: {
          schema: manifest.schema,
          candidate: manifest.candidate,
          commit: manifest.commit,
          platform: manifest.platform,
          status: manifest.status,
          runId: String(manifest.runId),
          archiveSha256: manifest.archiveSha256,
          exceptionReviewBy: manifest.exceptionReviewBy,
          images: Object.fromEntries(
            ["backend", "frontend"].map((k) => [
              k,
              Object.fromEntries(
                [
                  "localTag",
                  "localId",
                  "configDigest",
                  "user",
                  "architecture",
                  "registryRef",
                ]
                  .filter((n) => manifest.images[k][n] !== undefined)
                  .map((n) => [n, manifest.images[k][n]]),
              ),
            ]),
          ),
        },
        automated,
        origin: {
          kind: "local-checksummed-import",
          source: input.source,
          runId: String(manifest.runId),
          githubUrl: /^[1-9][0-9]*$/.test(String(manifest.runId))
            ? "https://github.com/Djone/suivi-cb/actions/runs/" + manifest.runId
            : null,
          authenticatedGithubProvenance: Boolean(githubProvenance),
          artifactId: githubProvenance?.artifactId || null,
          artifactDigest: githubProvenance?.artifactDigest || null,
        },
        scope: same
          ? old.scope
          : { frozen: false, summary: "", releaseNotes: "" },
        releasePlan: same ? old.releasePlan || null : null,
        executions: same ? old.executions || [] : [],
        validations: same ? old.validations : {},
        importedAt: new Date().toISOString(),
        importedBy: actor,
        previousIdentity: old?.identity || null,
        closedAt: null,
      };
      if (old) archiveDossier(old);
      save(d);
      return evaluate(d);
    });
  }
  async function update(input, actor) {
    return mutate(async () => {
      const d = load();
      if (!d || input.identity !== d.identity || input.revision !== d.revision)
        throw Error("STALE_DOSSIER");
      const previous = JSON.parse(JSON.stringify(d));
      if (input.action === "scope") {
        const s = input.scope;
        if (
          !s ||
          typeof s.summary !== "string" ||
          typeof s.releaseNotes !== "string" ||
          !s.summary.trim() ||
          !s.releaseNotes.trim() ||
          s.summary.length > 2000 ||
          s.releaseNotes.length > 8000 ||
          typeof s.frozen !== "boolean" ||
          containsSecret(s.summary) ||
          containsSecret(s.releaseNotes)
        )
          throw Error("INVALID_SCOPE");
        d.scope = {
          summary: s.summary.trim(),
          releaseNotes: s.releaseNotes.trim(),
          frozen: s.frozen,
        };
        d.validations = {};
      } else if (input.action === "release-plan") {
        const next = input.nextDevVersion;
        const stable = d.manifest.candidate.split("-rc.")[0];
        const pattern =
          /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)-dev$/;
        if (typeof next !== "string" || next.length > 50 || !pattern.test(next))
          throw Error("INVALID_NEXT_VERSION");
        const a = next.slice(0, -4).split(".").map(BigInt);
        const b = stable.split(".").map(BigInt);
        const first = a.findIndex((n, i) => n !== b[i]);
        if (first < 0 || a[first] < b[first])
          throw Error("NEXT_VERSION_MUST_INCREASE");
        if (d.releasePlan?.nextDevVersion !== next) {
          d.releasePlan = {
            stableVersion: stable,
            nextDevVersion: next,
            status: "planned",
            identity: d.identity,
            updatedBy: actor,
            updatedAt: new Date().toISOString(),
          };
          for (const k of Object.keys(MANUAL).filter(
            (k) => MANUAL[k][0] === "production",
          ))
            delete d.validations[k];
        }
      } else if (input.action === "validate") {
        if (!MANUAL[input.check] || typeof input.approved !== "boolean")
          throw Error("INVALID_VALIDATION");
        if (
          typeof input.reference !== "string" ||
          input.reference.length > 500 ||
          !input.reference.trim() ||
          containsSecret(input.reference)
        )
          throw Error("REFERENCE_REQUIRED");
        if (
          input.approved &&
          MANUAL[input.check][0] === "preproduction" &&
          !evaluate(d).readyForPreproduction
        )
          throw Error("DEVELOPMENT_BLOCKED");
        if (
          input.approved &&
          MANUAL[input.check][0] === "production" &&
          !evaluate(d).readyForProduction
        )
          throw Error("PRODUCTION_BLOCKED");
        if (
          input.check === "preproduction-approval" &&
          input.approved &&
          Object.keys(MANUAL)
            .filter(
              (k) => MANUAL[k][0] === "preproduction" && k !== input.check,
            )
            .some((k) => !d.validations[k]?.approved)
        )
          throw Error("PREPRODUCTION_BLOCKED");
        d.validations[input.check] = {
          kind: "human-declaration",
          identity: d.identity,
          approved: input.approved,
          by: actor,
          at: new Date().toISOString(),
          reference: input.reference.trim(),
        };
        if (!input.approved) {
          delete d.validations["preproduction-approval"];
          for (const k of Object.keys(MANUAL).filter(
            (k) => MANUAL[k][0] === "production",
          ))
            delete d.validations[k];
        }
      } else if (input.action === "close") {
        if (!evaluate(d).canClose) throw Error("CLOSURE_BLOCKED");
        d.closedAt = new Date().toISOString();
      } else throw Error("INVALID_ACTION");
      archiveDossier(previous);
      d.revision++;
      save(d);
      return evaluate(d);
    });
  }
  async function recordExecution(receipt) {
    return mutate(async () => {
      const d = load();
      if (
        !d ||
        receipt?.schema !== 1 ||
        receipt.identity !== d.identity ||
        receipt.candidate !== d.manifest.candidate ||
        receipt.commit !== d.manifest.commit ||
        receipt.archiveSha256 !== d.manifest.archiveSha256 ||
        receipt.productionApproved !== false ||
        receipt.databaseRestored !== false ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
          receipt.nonce || "",
        ) ||
        !["plan", "apply-preproduction"].includes(receipt.action) ||
        ![
          "PLAN_PASS",
          "PREPRODUCTION_SMOKE_PASS",
          "FAILED",
          "APPLY_DISABLED",
          "PLAN_REQUIRED",
        ].includes(receipt.status)
      )
        throw Error("DSM_RECEIPT_MISMATCH");
      if (
        (receipt.action === "plan" &&
          !["PLAN_PASS", "FAILED"].includes(receipt.status)) ||
        (receipt.action === "apply-preproduction" &&
          ![
            "PREPRODUCTION_SMOKE_PASS",
            "FAILED",
            "APPLY_DISABLED",
            "PLAN_REQUIRED",
          ].includes(receipt.status))
      )
        throw Error("DSM_RECEIPT_MISMATCH");
      if ((d.executions || []).some((x) => x.nonce === receipt.nonce))
        return evaluate(d);
      archiveDossier(d);
      const execution = Object.fromEntries(
        [
          "schema",
          "nonce",
          "identity",
          "candidate",
          "commit",
          "archiveSha256",
          "action",
          "status",
          "productionApproved",
          "databaseRestored",
        ].map((k) => [k, receipt[k]]),
      );
      d.executions = [
        ...(d.executions || []).slice(-19),
        {
          ...execution,
          kind: "nas-dsm-receipt",
          recordedAt: new Date().toISOString(),
        },
      ];
      d.revision++;
      save(d);
      return evaluate(d);
    });
  }
  function report() {
    const result = {
      ...evaluate(load()),
      generatedAt: new Date().toISOString(),
      reportType: "release-readiness-not-deployment-authorization",
    };
    const reports = path.join(store, "reports");
    fs.mkdirSync(reports, { recursive: true, mode: 0o700 });
    const reportId = crypto.randomUUID();
    result.reportId = reportId;
    fs.writeFileSync(
      path.join(reports, reportId + ".json"),
      JSON.stringify(result, null, 2) + "\n",
      { mode: 0o600, flag: "wx" },
    );
    return result;
  }
  return {
    read: () => evaluate(load()),
    importBundle,
    recordExecution,
    update,
    report,
    manual: MANUAL,
  };
}
module.exports = { createReleaseEvidence, identity, MANUAL };
