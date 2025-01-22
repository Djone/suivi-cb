// Schema de validation pour les catégories

const Joi = require('joi');

// Schéma de validation Joi pour une transaction
const transactionSchema = Joi.object({
    id: Joi.number().integer().positive()
      .optional()
      .description('L\'ID de la transaction, requis uniquement pour une mise à jour.'),
  
    description: Joi.string()
      .min(2)
      .max(255)
      .required()
      .description('Une description de la transaction (minimum 2 caractères).'),
  
    amount: Joi.number()
      .precision(2)
      .positive()
      .required()
      .description('Le montant de la transaction (nombre positif, 2 décimales max).'),

    account_id: Joi.number()
      .integer()
      .positive()
      .required()
      .description('L\'ID du compte (nombre entier positif).'),
  
    date: Joi.date()
      .iso()
      .required()
      .description('La date de la transaction au format ISO 8601.'),
  
    sub_category_id: Joi.number()
      .integer()
      .positive()
      .required()
      .description('L\'ID de la catégorie associée (nombre entier positif).'),
  
    financial_flow_id: Joi.number()
      .integer()
      .positive()
      .required()
      .description('L\'ID du type de transaction (nombre entier positif).'),
  });

module.exports = { 
    transactionSchema
};