const Joi = require('joi');

const splitMode = Joi.string().valid('equal', 'prorata', 'fixed', 'single');

const memberSchema = Joi.object({
  id: Joi.string().valid('A', 'B').required(),
  name: Joi.string().min(1).max(100).required(),
  color: Joi.string().allow(null, '').optional(),
  income: Joi.number().min(0).default(0),
});

const lineSchema = Joi.object({
  id: Joi.number().integer().positive().optional(),
  label: Joi.string().min(1).max(255).required(),
  categoryLabel: Joi.string().allow('', null).optional(),
  accountId: Joi.number().integer().positive().allow(null).optional(),
  accountName: Joi.string().allow('', null).optional(),
  amount: Joi.number().min(0).precision(2).required(),
  mode: splitMode.required(),
  fixedRatioA: Joi.number().min(0).max(100).default(50),
  payer: Joi.string().valid('A', 'B').allow(null).optional(),
  source: Joi.string().valid('recurring', 'manual').allow(null).optional(),
});

const coupleSplitConfigSchema = Joi.object({
  members: Joi.array().items(memberSchema).length(2).required(),
  lines: Joi.array().items(lineSchema).required(),
  customProrataA: Joi.number().min(0).max(100).default(50),
  ignoredRecurringIds: Joi.array().items(Joi.number().integer().positive()).default([]),
});

module.exports = {
  coupleSplitConfigSchema,
};
