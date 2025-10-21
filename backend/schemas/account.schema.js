const Joi = require('joi');

// Schéma de validation Joi pour un compte
const accountSchema = Joi.object({
  id: Joi.number().integer().positive()
    .optional()
    .description('L\'ID du compte, requis uniquement pour une mise à jour.'),

  name: Joi.string()
    .min(2)
    .max(100)
    .required()
    .description('Le nom du compte (minimum 2 caractères).'),

  description: Joi.string()
    .max(255)
    .allow(null, '')
    .optional()
    .description('Une description optionnelle du compte.'),

  color: Joi.string()
    .pattern(/^#[0-9A-Fa-f]{6}$/)
    .default('#1976d2')
    .optional()
    .description('La couleur du compte au format hexadécimal (ex: #1976d2).'),

  isActive: Joi.number()
    .integer()
    .valid(0, 1)
    .default(1)
    .optional()
    .description('Statut du compte (1 = actif, 0 = inactif).'),
});

module.exports = { accountSchema };
