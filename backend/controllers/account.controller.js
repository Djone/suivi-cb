const Account = require('../models/account.model');
const { accountSchema } = require('../schemas/account.schema');

// Récupérer tous les comptes actifs
exports.getAllAccounts = async (req, res) => {
  try {
    const accounts = await Account.getAll();
    res.status(200).json(accounts);
  } catch (err) {
    console.error('ACCOUNT CONTROLLER : Erreur lors de la récupération des comptes', err.message);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération des comptes.' });
  }
};

// Récupérer tous les comptes y compris inactifs
exports.getAllAccountsIncludingInactive = async (req, res) => {
  try {
    const accounts = await Account.getAllIncludingInactive();
    res.status(200).json(accounts);
  } catch (err) {
    console.error('ACCOUNT CONTROLLER : Erreur lors de la récupération de tous les comptes', err.message);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération des comptes.' });
  }
};

// Récupérer un compte par son ID
exports.getAccountById = async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID invalide.' });
  }

  try {
    const account = await Account.getById(id);
    res.status(200).json(account);
  } catch (err) {
    console.error('ACCOUNT CONTROLLER : Erreur lors de la récupération du compte', err.message);
    res.status(404).json({ error: 'Compte non trouvé.' });
  }
};

// Ajouter un nouveau compte
exports.addAccount = async (req, res) => {
  console.log('ACCOUNT CONTROLLER : Ajout d\'un compte', req.body);

  const { error, value } = accountSchema.validate(req.body, { abortEarly: false });

  if (error) {
    const errors = error.details.map((detail) => detail.message);
    console.error('ACCOUNT CONTROLLER : Erreurs de validation', errors);
    return res.status(400).json({ errors });
  }

  try {
    const result = await Account.add(value);
    res.status(201).json({ message: 'Compte ajouté avec succès.', id: result.id });
  } catch (err) {
    console.error('ACCOUNT CONTROLLER : Erreur lors de l\'ajout du compte', err.message);
    res.status(500).json({ error: 'Erreur serveur lors de l\'ajout du compte.' });
  }
};

// Mettre à jour un compte
exports.updateAccount = async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID invalide.' });
  }

  console.log('ACCOUNT CONTROLLER : Mise à jour du compte', id, req.body);

  const { error, value } = accountSchema.validate(req.body, { abortEarly: false });

  if (error) {
    const errors = error.details.map((detail) => detail.message);
    console.error('ACCOUNT CONTROLLER : Erreurs de validation', errors);
    return res.status(400).json({ errors });
  }

  try {
    await Account.update(id, value);
    res.status(200).json({ message: 'Compte mis à jour avec succès.' });
  } catch (err) {
    console.error('ACCOUNT CONTROLLER : Erreur lors de la mise à jour du compte', err.message);
    res.status(500).json({ error: 'Erreur serveur lors de la mise à jour du compte.' });
  }
};

// Désactiver un compte
exports.deactivateAccount = async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID invalide.' });
  }

  try {
    await Account.deactivate(id);
    res.status(200).json({ message: 'Compte désactivé avec succès.' });
  } catch (err) {
    console.error('ACCOUNT CONTROLLER : Erreur lors de la désactivation du compte', err.message);
    res.status(500).json({ error: 'Erreur serveur lors de la désactivation du compte.' });
  }
};

// Réactiver un compte
exports.reactivateAccount = async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID invalide.' });
  }

  try {
    await Account.reactivate(id);
    res.status(200).json({ message: 'Compte réactivé avec succès.' });
  } catch (err) {
    console.error('ACCOUNT CONTROLLER : Erreur lors de la réactivation du compte', err.message);
    res.status(500).json({ error: 'Erreur serveur lors de la réactivation du compte.' });
  }
};
