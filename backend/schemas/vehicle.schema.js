const Joi = require('joi');

const vehicleSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  brand: Joi.string().trim().max(80).allow('', null).optional(),
  model: Joi.string().trim().max(80).allow('', null).optional(),
  energy_type: Joi.string().valid('gasoline', 'diesel', 'hybrid', 'electric', 'other').required(),
  registration: Joi.string().trim().max(30).allow('', null).optional(),
  acquisition_date: Joi.date().iso().allow(null).optional(),
  purchase_price: Joi.number().min(0).allow(null).optional(),
  annual_distance: Joi.number().min(0).allow(null).optional(),
  consumption_per_100: Joi.number().min(0).allow(null).optional(),
  energy_price: Joi.number().min(0).allow(null).optional(),
  is_active: Joi.alternatives().try(Joi.boolean(), Joi.number().valid(0, 1)).optional(),
});

const vehicleOperationSchema = Joi.object({
  date: Joi.date().iso().required(),
  label: Joi.string().trim().min(2).max(255).required(),
  amount: Joi.number().positive().precision(2).required(),
  sub_category_id: Joi.number().integer().positive().required(),
  vehicle_id: Joi.number().integer().positive().required(),
});

module.exports = { vehicleSchema, vehicleOperationSchema };
