// backend/controllers/transaction.controller.js
// Codes retour
// 200: Succes
// 201: Ressource creee
// 400: Mauvaise requete
// 404: Ressource introuvable
// 500: Erreur serveur

const Transaction = require('../models/transaction.model');

exports.getAllTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.getAll(req.query);
    res.status(200).json(transactions);
  } catch (err) {
    console.error('Erreur lors de la recuperation des transactions :', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
};

exports.addTransaction = async (req, res) => {
  try {
    const newTransaction = req.body;

    if (newTransaction.date) {
      const date = new Date(newTransaction.date);
      newTransaction.date = date.toLocaleDateString('en-CA');
    }

    const result = await Transaction.add(newTransaction);

    res.status(201).json({
      message: 'Transaction ajoutee avec succes',
      id: result.id,
    });
  } catch (err) {
    console.error("Erreur lors de l'ajout de la transaction :", err);

    if (err.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({
        error: 'La transaction existe deja ou les donnees sont invalides.',
      });
    }

    res.status(500).json({
      error: "Erreur interne du serveur lors de l'ajout de la transaction",
    });
  }
};

exports.updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const fieldsToUpdate = req.body;

    if (fieldsToUpdate.date) {
      const date = new Date(fieldsToUpdate.date);
      fieldsToUpdate.date = date.toLocaleDateString('en-CA');
    }

    if (!id) {
      return res.status(400).json({ error: 'ID de la transaction manquant.' });
    }

    const result = await Transaction.update(id, fieldsToUpdate);

    res.status(200).json({
      message: 'Transaction mise a jour avec succes.',
      changes: result.changes,
    });
  } catch (err) {
    console.error('Erreur lors de la mise a jour de la transaction :', err.message || err);
    res.status(500).json({
      error: 'Erreur interne du serveur lors de la mise a jour de la transaction.',
    });
  }
};

exports.deleteTransactionById = async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (!id) {
    return res.status(400).json({ error: 'ID invalide pour la suppression.' });
  }

  try {
    await Transaction.deleteById(id);
    res.status(200).json({ message: 'Transaction supprimee avec succes.' });
  } catch (err) {
    console.error('Erreur lors de la suppression de la transaction :', err.message);
    if (err.message === 'Aucune transaction trouvée avec cet ID.') {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: 'Erreur lors de la suppression de la transaction.' });
  }
};
