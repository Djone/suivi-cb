// backend/routes/config.routes.js
const express = require('express');
const router = express.Router();
const configController = require('../controllers/config.controller');

// Route pour obtenir la configuration du compte (ancienne version)
router.get('/account', configController.getAccountConfig);

// Route pour mettre à jour la configuration du compte (ancienne version)
router.put('/account', configController.updateAccountConfig);

// Routes pour la configuration de tous les comptes
router.get('/accounts', configController.getAccountsConfig);
router.put('/accounts', configController.updateAccountsConfig);

module.exports = router;
