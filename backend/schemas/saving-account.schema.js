const Joi = require('joi');

const savingAccountUpdateSchema = Joi.object({
  currentBalance: Joi.number().min(0).required(),
  targetBalance: Joi.number().min(0).allow(null).required(),
  minimumBalance: Joi.number().min(0).allow(null).required(),
  includeInDailyBudget: Joi.boolean().required(),
  includeInWealth: Joi.boolean().required(),
});

const savingAccountSettingsSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  bankName: Joi.string().trim().min(2).max(100).required(),
  role: Joi.string().valid(
    'leisure', 'emergency', 'online_payment', 'savings', 'investment', 'employee_savings',
  ).required(),
  liquidityLevel: Joi.string().valid('instant', 'day_1', 'long_term').required(),
  currentBalance: Joi.number().min(0).required(),
  targetBalance: Joi.number().min(0).allow(null).required(),
  minimumBalance: Joi.number().min(0).allow(null).required(),
  includeInDailyBudget: Joi.boolean().required(),
  includeInWealth: Joi.boolean().required(),
});

module.exports = { savingAccountUpdateSchema, savingAccountSettingsSchema };
