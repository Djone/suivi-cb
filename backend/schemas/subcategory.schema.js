//Schema de validation pour les sous-catégories

const Joi = require('joi');

// Schéma pour l'ajout d'une nouvelle sous-catégories
const subCategorySchema = Joi.object({
    label: Joi.string().min(1).max(255).required(),
    category_id: Joi.number().integer().required(),
});

// Schéma pour la mise à jour des sous-catégories
const subCategoryUpdateSchema = Joi.object({
    label: Joi.string().optional(), // Le libellé peut être mis à jour
    category_id: Joi.number().integer().optional(), // Le type peut être mis à jour
}).min(1); // Au moins un champ doit être présent

module.exports = { 
    subCategorySchema,
    subCategoryUpdateSchema
};