const express = require('express');
const router = express.Router();
const releaseController = require('../controllers/release.controller');

const { createEvidenceRouter } = require('./release-evidence.routes');
router.use('/evidence', createEvidenceRouter());

router.get('/status', releaseController.getReleaseStatus);
router.get('/next-candidate', releaseController.getNextCandidate);
router.post('/run', releaseController.runReleaseCommand);

module.exports = router;
