const express = require('express');
const validate = require('../middlewares/validation.middleware');
const controller = require('../controllers/saving-account.controller');
const { savingAccountUpdateSchema } = require('../schemas/saving-account.schema');

const router = express.Router();
router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.patch('/:id', validate(savingAccountUpdateSchema), controller.update);

module.exports = router;
