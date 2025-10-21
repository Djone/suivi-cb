// backend/controllers/config.controller.js
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../config/account.config.json');
const accountsConfigPath = path.join(__dirname, '../config/accounts.config.json');

// Lire la configuration du compte
exports.getAccountConfig = (req, res) => {
    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log('Configuration du compte récupérée:', config);
        res.status(200).json(config);
    } catch (err) {
        console.error('Erreur lors de la lecture de la configuration:', err);
        res.status(500).json({ error: 'Erreur lors de la lecture de la configuration' });
    }
};

// Mettre à jour la configuration du compte
exports.updateAccountConfig = (req, res) => {
    try {
        const { initialBalance, accountName, currency } = req.body;

        const config = {
            initialBalance: initialBalance || 0,
            accountName: accountName || 'Mon Compte Principal',
            currency: currency || 'EUR'
        };

        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        console.log('Configuration du compte mise à jour:', config);
        res.status(200).json({ message: 'Configuration mise à jour avec succès', config });
    } catch (err) {
        console.error('Erreur lors de la mise à jour de la configuration:', err);
        res.status(500).json({ error: 'Erreur lors de la mise à jour de la configuration' });
    }
};

// Lire la configuration de tous les comptes
exports.getAccountsConfig = (req, res) => {
    try {
        const config = JSON.parse(fs.readFileSync(accountsConfigPath, 'utf8'));
        console.log('Configuration des comptes récupérée:', config);
        res.status(200).json(config);
    } catch (err) {
        console.error('Erreur lors de la lecture de la configuration des comptes:', err);
        res.status(500).json({ error: 'Erreur lors de la lecture de la configuration des comptes' });
    }
};

// Mettre à jour la configuration de tous les comptes
exports.updateAccountsConfig = (req, res) => {
    try {
        const { accounts } = req.body;

        if (!accounts || !Array.isArray(accounts)) {
            return res.status(400).json({ error: 'Format de configuration invalide' });
        }

        const config = { accounts };

        fs.writeFileSync(accountsConfigPath, JSON.stringify(config, null, 2), 'utf8');
        console.log('Configuration des comptes mise à jour:', config);
        res.status(200).json({ message: 'Configuration mise à jour avec succès', config });
    } catch (err) {
        console.error('Erreur lors de la mise à jour de la configuration des comptes:', err);
        res.status(500).json({ error: 'Erreur lors de la mise à jour de la configuration des comptes' });
    }
};
