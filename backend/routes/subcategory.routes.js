/*
Le fichier subcategory.routes.js est responsable de définir les routes associées à la gestion des catégories dans votre application Express. 
Il mappe les différentes URL (/api/categories et ses variantes) aux méthodes du contrôleur qui contiennent la logique métier pour chaque opération (ajout, mise à jour, suppression, etc.).
*/

const express = require('express'); //Framework Node.js utilisé pour gérer les routes HTTP.
const router = express.Router(); //Instance d'un routeur Express, permettant de définir des routes spécifiques pour les catégories.
const validate = require('../middlewares/validation.middleware'); //Middleware de validation qui utilise un schéma (comme Joi) pour valider les données entrantes.
const { subCategorySchema } = require('../schemas/subcategory.schema'); //Schéma de validation définissant les règles pour les données des catégories.
const { subCategoryUpdateSchema } = require('../schemas/subcategory.schema'); // Schéma de validation spécifique pour la mise à jour
const subCategoryController = require('../controllers/subcategory.controller'); //Contrôleur regroupant les fonctions responsables des opérations CRUD sur les catégories.

// Route pour obtenir toutes les sous-catégories (GET)
router.get('/', subCategoryController.getAllSubCategories);  // Correspond à /api/sous-categories
router.get('/:financialFlowId', subCategoryController.getAllSubCategoriesByfinancielFlowId);  // Correspond à /api/sous-categories

// Route pour ajouter une sous-catégorie (POST)
router.post('/', validate(subCategorySchema), subCategoryController.addSubCategory);  // Correspond à /api/sous-categories

// Route pour mettre à jour une sous-catégorie (PUT)
router.put('/:id', validate(subCategoryUpdateSchema), subCategoryController.updateSubCategory);  // Correspond à /api/sous-categories/:id

// Route pour supprimer une sous-catégorie par ID (DELETE)
router.delete('/:id', subCategoryController.deleteSubCategoryById);

module.exports = router;