/* backend/routes/categoryRoutes

Le fichier category.routes.js est responsable de définir les routes associées à la gestion des catégories dans l'application Express. 
Il mappe les différentes URL (/api/categories et ses variantes) aux méthodes du contrôleur qui contiennent la logique métier pour chaque opération (ajout, mise à jour, suppression, etc.).
*/

const express = require('express'); // Framework Node.js utilisé pour gérer les routes HTTP.
const router = express.Router(); // Instance d'un routeur Express, permettant de définir des routes spécifiques pour les catégories.
const validate = require('../middlewares/validation.middleware'); // Middleware de validation qui utilise un schéma (comme Joi) pour valider les données entrantes.
const { categorySchema } = require('../schemas/category.schema'); // Schéma de validation définissant les règles pour les données des catégories.
const { categoryUpdateSchema } = require('../schemas/category.schema'); // Schéma de validation spécifique pour la mise à jour
const categoryController = require('../controllers/category.controller'); // Contrôleur regroupant les fonctions responsables des opérations CRUD sur les catégories.

// Route pour obtenir toutes les catégories (GET)
router.get('/', categoryController.getAllCategories);  // Correspond à /api/categories

// Route pour ajouter une catégorie (POST)
router.post('/', validate(categorySchema), categoryController.addCategory);  // Correspond à /api/categories

// Route pour mettre à jour une catégorie (PUT)
router.put('/:id', validate(categoryUpdateSchema), categoryController.updateCategory);  // Correspond à /api/categories/:id

// Route pour supprimer une catégorie par ID (DELETE)
router.delete('/:id', categoryController.deleteCategoryById);

module.exports = router;