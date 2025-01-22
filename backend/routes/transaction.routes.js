/* backend/routes/transactionRoutes

Le fichier transaction.routes.js est responsable de définir les routes associées à la gestion des transcations dans l'application Express. 
Il mappe les différentes URL (/api/transactions et ses variantes) aux méthodes du contrôleur qui contiennent la logique métier pour chaque opération (ajout, mise à jour, suppression, etc.).
*/
const express = require('express'); // Framework Node.js utilisé pour gérer les routes HTTP.
const router = express.Router(); // Instance d'un routeur Express, permettant de définir des routes spécifiques pour les catégories.
const validate = require('../middlewares/validation.middleware'); // Middleware de validation qui utilise un schéma (comme Joi) pour valider les données entrantes.
const { transactionSchema } = require('../schemas/transaction.schema'); // Schéma de validation définissant les règles pour les données des catégories.
const transactionController = require('../controllers/transaction.controller');

router.get('/', transactionController.getAllTransactions);  // Route pour lire toutes les transactions
router.post('/', validate(transactionSchema), transactionController.addTransaction);  // Route pour ajouter une transaction
router.put('/:id', validate(transactionSchema), transactionController.updateTransaction);  // Route pour modifier une transaction
router.delete('/:id', transactionController.deleteTransactionById);  // Route pour supprimer une transaction

module.exports = router;