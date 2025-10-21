// backend/controllers/recurring-transaction.controller.js
const RecurringTransaction = require('../models/recurring-transaction.model');

exports.getAllRecurringTransactions = async (req, res) => {
  try {
    const recurringTransactions = await RecurringTransaction.getAll();
    console.log('Transactions récurrentes récupérées:', recurringTransactions);
    res.status(200).json(recurringTransactions);
  } catch (err) {
    console.error('Erreur lors de la récupération des transactions récurrentes:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
};

exports.addRecurringTransaction = async (req, res) => {
  try {
    const newRecurringTransaction = req.body;
    console.log('Requête reçue pour ajouter une transaction récurrente:', newRecurringTransaction);

    const result = await RecurringTransaction.add(newRecurringTransaction);

    res.status(201).json({
      message: 'Transaction récurrente ajoutée avec succès',
      id: result.id
    });
  } catch (err) {
    console.error('Erreur lors de l\'ajout de la transaction récurrente:', err);
    res.status(500).json({
      error: 'Erreur interne du serveur lors de l\'ajout de la transaction récurrente'
    });
  }
};

exports.updateRecurringTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const fieldsToUpdate = req.body;

    console.log('ID reçu:', id);
    console.log('Données reçues pour mise à jour:', fieldsToUpdate);

    if (!id) {
      return res.status(400).json({ error: 'ID de la transaction récurrente manquant.' });
    }

    const updateData = { id, ...fieldsToUpdate };
    const result = await RecurringTransaction.update(updateData);

    res.status(200).json({
      message: 'Transaction récurrente mise à jour avec succès.',
      updateData,
      changes: result.changes,
    });
  } catch (err) {
    console.error('Erreur lors de la mise à jour de la transaction récurrente:', err.message || err);
    res.status(500).json({
      error: 'Erreur interne du serveur lors de la mise à jour de la transaction récurrente.',
    });
  }
};

exports.deleteRecurringTransactionById = async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (!id) {
    return res.status(400).json({ error: 'ID invalide pour la suppression.' });
  }

  try {
    await RecurringTransaction.deleteById(id);
    res.status(200).json({ message: 'Transaction récurrente désactivée avec succès.' });
  } catch (err) {
    console.error('Erreur lors de la désactivation de la transaction récurrente:', err.message);
    if (err.message === 'Aucune transaction récurrente trouvée avec cet ID.') {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: 'Erreur lors de la désactivation de la transaction récurrente.' });
  }
};

exports.reactivateRecurringTransaction = async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (!id) {
    return res.status(400).json({ error: 'ID invalide pour la réactivation.' });
  }

  try {
    await RecurringTransaction.reactivate(id);
    res.status(200).json({ message: 'Transaction récurrente réactivée avec succès.' });
  } catch (err) {
    console.error('Erreur lors de la réactivation de la transaction récurrente:', err.message);
    if (err.message === 'Aucune transaction récurrente trouvée avec cet ID.') {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: 'Erreur lors de la réactivation de la transaction récurrente.' });
  }
};
