const express = require('express');
const router = express.Router();
const accountController = require('../controllers/account.controller');

// Routes pour les comptes
router.get('/', accountController.getAllAccounts);
router.get('/all', accountController.getAllAccountsIncludingInactive);
router.get('/:id', accountController.getAccountById);
router.post('/', accountController.addAccount);
router.put('/:id', accountController.updateAccount);
router.patch('/:id/deactivate', accountController.deactivateAccount);
router.patch('/:id/reactivate', accountController.reactivateAccount);

module.exports = router;
