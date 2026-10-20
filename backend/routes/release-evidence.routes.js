const express = require("express");
const { createReleaseEvidence } = require("../services/release-evidence");
function createEvidenceRouter(service = createReleaseEvidence()) {
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
