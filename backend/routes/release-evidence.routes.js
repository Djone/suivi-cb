const express = require("express");
const { createReleaseEvidence } = require("../services/release-evidence");
const { createCandidateFlow } = require("../services/release-candidate-flow");
function createEvidenceRouter(
  service = createReleaseEvidence(),
  flow = createCandidateFlow({ evidence: service }),
) {
  const router = express.Router();
  const actor = (req) =>
    String(req.auth?.sub || "local-operator").slice(0, 100);
  const handle = (fn) => async (req, res) => {
    try {
      res.set("Cache-Control", "no-store");
      res.json(await fn(req));
    } catch (e) {
      const code = /^[A-Z_]+$/.test(e.message)
        ? e.message
        : "EVIDENCE_UNAVAILABLE";
      res
        .status(
          code === "EVIDENCE_UNAVAILABLE"
            ? 500
            : code === "EVIDENCE_BUSY" || code === "STALE_DOSSIER"
              ? 409
              : 422,
        )
        .json({ message: code });
    }
  };
  const makeNasKit = require("../services/release-nas-kit").createNasKit({
    evidence: service,
  });
  router.post("/candidate/nas-kit", async (req, res) => {
    try {
      const a = await makeNasKit(req.body || {}, actor(req));
      res.set("Cache-Control", "no-store");
      res.download(a.file, a.name);
    } catch {
      res.status(422).json({ message: "PREPRODUCTION_KIT_BLOCKED" });
    }
  });
  router.get(
    "/candidate",
    handle(() => flow.status()),
  );
  router.post(
    "/candidate",
    handle((req) => flow.prepare(req.body || {}, actor(req))),
  );
  router.get("/candidate/archive", async (req, res) => {
    try {
      const a = await flow.archive();
      res.set("Cache-Control", "no-store");
      res.download(a.file, a.name);
    } catch {
      res.status(422).json({ message: "CANDIDATE_NOT_READY" });
    }
  });
  router.get(
    "/",
    handle(() => service.read()),
  );
  router.post(
    "/import",
    handle((req) => service.importBundle(req.body || {}, actor(req))),
  );
  router.post(
    "/",
    handle((req) => service.update(req.body || {}, actor(req))),
  );
  router.post(
    "/report",
    handle(() => service.report()),
  );
  router.get(
    "/report",
    handle(() => ({
      ...service.read(),
      generatedAt: new Date().toISOString(),
      reportType: "release-readiness-not-deployment-authorization",
    })),
  );
  return router;
}
module.exports = { createEvidenceRouter };
