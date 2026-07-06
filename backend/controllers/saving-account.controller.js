const SavingAccount = require('../models/saving-account.model');

exports.getAll = async (_req, res) => {
  try {
    res.status(200).json(await SavingAccount.getAll());
  } catch (error) {
    console.error('SAVING ACCOUNT: read error', error.message);
    res.status(500).json({ error: "Impossible de charger les comptes d'epargne." });
  }
};

exports.getById = async (req, res) => {
  try {
    const account = await SavingAccount.getById(Number(req.params.id));
    if (!account) return res.status(404).json({ error: 'Compte introuvable.' });
    res.status(200).json(account);
  } catch (_error) {
    res.status(500).json({ error: "Impossible de charger le compte d'epargne." });
  }
};

exports.update = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!(await SavingAccount.update(id, req.body))) {
      return res.status(404).json({ error: 'Compte introuvable.' });
    }
    res.status(200).json(await SavingAccount.getById(id));
  } catch (error) {
    console.error('SAVING ACCOUNT: update error', error.message);
    res.status(500).json({ error: "Impossible de mettre a jour le compte d'epargne." });
  }
};

exports.create = async (req, res) => {
  try {
    const providerKey = `custom_${Date.now()}`;
    const id = await SavingAccount.create({ ...req.body, providerKey });
    res.status(201).json(await SavingAccount.getById(id));
  } catch (error) {
    console.error('SAVING ACCOUNT: create error', error.message);
    res.status(500).json({ error: "Impossible de creer le compte d'epargne." });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!(await SavingAccount.updateSettings(id, req.body))) {
      return res.status(404).json({ error: 'Compte introuvable.' });
    }
    res.status(200).json(await SavingAccount.getById(id));
  } catch (error) {
    res.status(500).json({ error: "Impossible de modifier le compte d'epargne." });
  }
};

exports.remove = async (req, res) => {
  try {
    if (!(await SavingAccount.deactivate(Number(req.params.id)))) {
      return res.status(404).json({ error: 'Compte introuvable.' });
    }
    res.status(204).send();
  } catch (error) {
    if (error.code === 'PROTECTED_ACCOUNT') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "Impossible de supprimer le compte d'epargne." });
  }
};
