// backend/schemas/recurring-transaction.schema.js
const Joi = require('joi');

const recurringTransactionSchema = Joi.object({
  id: Joi.number().integer().positive().optional(),

  label: Joi.string()
    .min(2)
    .max(255)
    .required()
    .description('Le libellé de la transaction récurrente'),

  amount: Joi.number()
    .precision(2)
    .positive()
    .required()
    .description('Le montant de la transaction'),

  day_of_month: Joi.number()
    .integer()
    .min(1)
    .max(31)
    .required()
    .description('Le jour du mois (1-31) ou le jour de la semaine (1-7) pour hebdomadaire'),

  frequency: Joi.string()
    .valid('weekly', 'monthly', 'bimonthly', 'quarterly', 'biannual', 'yearly')
    .default('monthly')
    .description('La périodicité de la transaction récurrente'),

  account_id: Joi.number()
    .integer()
    .positive()
    .required()
    .description('L\'ID du compte'),

  sub_category_id: Joi.number()
    .integer()
    .positive()
    .required()
    .description('L\'ID de la sous-catégorie'),

  financial_flow_id: Joi.number()
    .integer()
    .positive()
    .required()
    .description('L\'ID du flux financier (1=Revenu, 2=Dépense)'),
});

module.exports = { recurringTransactionSchema };
