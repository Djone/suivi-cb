const Joi = require('joi');

const savingAccountUpdateSchema = Joi.object({
  currentBalance: Joi.number().min(0).required(),
  targetBalance: Joi.number().min(0).allow(null).required(),
  minimumBalance: Joi.number().min(0).allow(null).required(),
  includeInDailyBudget: Joi.boolean().required(),
  includeInWealth: Joi.boolean().required(),
});

module.exports = { savingAccountUpdateSchema };
