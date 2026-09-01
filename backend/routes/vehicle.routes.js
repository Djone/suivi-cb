const router = require('express').Router();
const validate = require('../middlewares/validation.middleware');
const controller = require('../controllers/vehicle.controller');
const {
  vehicleSchema,
  vehicleOperationSchema,
} = require('../schemas/vehicle.schema');

router.get('/', controller.getAll);
router.get('/operations', controller.getOperations);
router.post('/operations', validate(vehicleOperationSchema), controller.createOperation);
router.delete('/operations/:id', controller.deleteOperation);
router.post('/', validate(vehicleSchema), controller.create);
router.put('/:id', validate(vehicleSchema), controller.update);

module.exports = router;
