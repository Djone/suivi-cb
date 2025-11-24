// backend/routes/recurring-transaction.routes.js
const express = require('express');
const router = express.Router();
const validate = require('../middlewares/validation.middleware');
const { recurringTransactionSchema } = require('../schemas/recurring-transaction.schema');
const recurringTransactionController = require('../controllers/recurring-transaction.controller');

// Route pour obtenir toutes les transactions récurrentes
router.get('/', recurringTransactionController.getAllRecurringTransactions);

// Route pour ajouter une transaction récurrente
router.post('/', validate(recurringTransactionSchema), recurringTransactionController.addRecurringTransaction);

// Route pour mettre à jour une transaction récurrente
router.put('/:id', validate(recurringTransactionSchema), recurringTransactionController.updateRecurringTransaction);

// Route pour supprimer (désactiver) une transaction récurrente
router.delete('/:id', recurringTransactionController.deleteRecurringTransactionById);

// Route pour réactiver une transaction récurrente
router.patch('/:id/reactivate', recurringTransactionController.reactivateRecurringTransaction);

// Historique des montants d'une transaction r��currente
router.get('/:id/history', recurringTransactionController.getHistoryForRecurringTransaction);
router.post('/:id/history', recurringTransactionController.addHistoryEntryForRecurringTransaction);

module.exports = router;

