// Schema de validation pour les catégories

const Joi = require('joi');

// Schéma pour l'ajout d'une nouvelle catégorie
const categorySchema = Joi.object({
    label: Joi.string().min(1).max(255).required(),
    financial_flow_id: Joi.number().integer().required(),
});

// Schéma pour la mise à jour des catégories
const categoryUpdateSchema = Joi.object({
    label: Joi.string().optional(), // Le libellé peut être mis à jour
    financial_flow_id: Joi.number().integer().optional(), // Le type peut être mis à jour
}).min(1); // Au moins un champ doit être présent

module.exports = { 
    categorySchema,
    categoryUpdateSchema
};