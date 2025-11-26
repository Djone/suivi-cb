const express = require('express');
const router = express.Router();
const validate = require('../middlewares/validation.middleware');
const { coupleSplitConfigSchema } = require('../schemas/couple-split.schema');
const controller = require('../controllers/couple-split.controller');

router.get('/config', controller.getConfig);
router.put('/config', validate(coupleSplitConfigSchema), controller.updateConfig);
router.post('/compute', validate(coupleSplitConfigSchema), controller.compute);
router.get('/recurring-lines', controller.getRecurringLines);

module.exports = router;
