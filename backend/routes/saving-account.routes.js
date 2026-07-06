const express = require('express');
const validate = require('../middlewares/validation.middleware');
const controller = require('../controllers/saving-account.controller');
const { savingAccountUpdateSchema, savingAccountSettingsSchema } = require('../schemas/saving-account.schema');

const router = express.Router();
router.get('/', controller.getAll);
router.post('/', validate(savingAccountSettingsSchema), controller.create);
router.get('/:id', controller.getById);
router.patch('/:id', validate(savingAccountUpdateSchema), controller.update);
router.put('/:id', validate(savingAccountSettingsSchema), controller.updateSettings);
router.delete('/:id', controller.remove);

module.exports = router;
