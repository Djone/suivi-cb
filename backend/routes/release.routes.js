const express = require('express');
const router = express.Router();
const releaseController = require('../controllers/release.controller');

router.get('/status', releaseController.getReleaseStatus);
router.post('/run', releaseController.runReleaseCommand);

module.exports = router;
