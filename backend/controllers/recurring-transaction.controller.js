// backend/controllers/recurring-transaction.controller.js
const RecurringTransaction = require("../models/recurring-transaction.model");
const RecurringHistory = require("../models/recurring-transaction-history.model");

exports.getAllRecurringTransactions = async (req, res) => {
  try {
    const recurringTransactions = await RecurringTransaction.getAll();
    res.status(200).json(recurringTransactions);
  } catch (err) {
    console.error(
      "Erreur lors de la récupération des transactions récurrentes:",
      err
    );
    res.status(500).json({ error: "Erreur interne du serveur" });
  }
};

exports.addRecurringTransaction = async (req, res) => {
  try {
    const newRecurringTransaction = { ...req.body };
    // Sérialiser active_months si fourni en tableau (ou camelCase depuis le front)
    if (Array.isArray(newRecurringTransaction.activeMonths)) {
      newRecurringTransaction.active_months = JSON.stringify(
        newRecurringTransaction.activeMonths
      );
      delete newRecurringTransaction.activeMonths;
    }
    if (Array.isArray(newRecurringTransaction.active_months)) {
      newRecurringTransaction.active_months = JSON.stringify(
        newRecurringTransaction.active_months
      );
    }
    console.log(
      "Requête reçue pour ajouter une transaction récurrente:",
      newRecurringTransaction
    );

    const result = await RecurringTransaction.add(newRecurringTransaction);

    res.status(201).json({
      message: "Transaction récurrente ajoutée avec succès",
      id: result.id,
    });
  } catch (err) {
    console.error("Erreur lors de l'ajout de la transaction récurrente:", err);
    res.status(500).json({
      error:
        "Erreur interne du serveur lors de l'ajout de la transaction récurrente",
    });
  }
};

exports.updateRecurringTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const fieldsToUpdate = { ...req.body };
    if (Array.isArray(fieldsToUpdate.activeMonths)) {
      fieldsToUpdate.active_months = JSON.stringify(
        fieldsToUpdate.activeMonths
      );
      delete fieldsToUpdate.activeMonths;
    }
    if (Array.isArray(fieldsToUpdate.active_months)) {
      fieldsToUpdate.active_months = JSON.stringify(
        fieldsToUpdate.active_months
      );
    }

    console.log("ID reçu:", id);
    console.log("Données reçues pour mise à jour:", fieldsToUpdate);

    if (!id) {
      return res
        .status(400)
        .json({ error: "ID de la transaction récurrente manquant." });
    }

    const updateData = { id, ...fieldsToUpdate };
    const result = await RecurringTransaction.update(updateData);

    res.status(200).json({
      message: "Transaction récurrente mise à jour avec succès.",
      updateData,
      changes: result.changes,
    });
  } catch (err) {
    console.error(
      "Erreur lors de la mise à jour de la transaction récurrente:",
      err.message || err
    );
    res.status(500).json({
      error:
        "Erreur interne du serveur lors de la mise à jour de la transaction récurrente.",
    });
  }
};

exports.deleteRecurringTransactionById = async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (!id) {
    return res.status(400).json({ error: "ID invalide pour la suppression." });
  }

  try {
    await RecurringTransaction.deleteById(id);
    res
      .status(200)
      .json({ message: "Transaction récurrente désactivée avec succès." });
  } catch (err) {
    console.error(
      "Erreur lors de la désactivation de la transaction récurrente:",
      err.message
    );
    if (err.message === "Aucune transaction récurrente trouvée avec cet ID.") {
      return res.status(404).json({ error: err.message });
    }
    res
      .status(500)
      .json({
        error: "Erreur lors de la désactivation de la transaction récurrente.",
      });
  }
};

exports.reactivateRecurringTransaction = async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (!id) {
    return res.status(400).json({ error: "ID invalide pour la réactivation." });
  }

  try {
    await RecurringTransaction.reactivate(id);
    res
      .status(200)
      .json({ message: "Transaction récurrente réactivée avec succès." });
  } catch (err) {
    console.error(
      "Erreur lors de la réactivation de la transaction récurrente:",
      err.message
    );
    if (err.message === "Aucune transaction récurrente trouvée avec cet ID.") {
      return res.status(404).json({ error: err.message });
    }
    res
      .status(500)
      .json({
        error: "Erreur lors de la réactivation de la transaction récurrente.",
      });
  }
};

exports.getHistoryForRecurringTransaction = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) {
    return res.status(400).json({ error: "ID invalide pour l'historique." });
  }
  try {
    const history = await RecurringHistory.getByRecurringId(id);
    res.status(200).json(history);
  } catch (err) {
    console.error(
      "Erreur lors de la lecture de l'historique des montants:",
      err.message || err
    );
    res
      .status(500)
      .json({ error: "Erreur lors de la lecture de l'historique." });
  }
};

exports.addHistoryEntryForRecurringTransaction = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) {
    return res.status(400).json({ error: "ID invalide pour l'historique." });
  }
  const {
    amount,
    effectiveFrom,
    effective_from: effectiveFromSnake,
  } = req.body || {};
  if (typeof amount !== "number" || Number.isNaN(amount)) {
    return res
      .status(400)
      .json({ error: "Montant invalide pour l'historique." });
  }
  const effectiveDate = effectiveFrom || effectiveFromSnake || new Date();
  try {
    const result = await RecurringHistory.addEntry({
      recurringId: id,
      amount,
      effectiveFrom: effectiveDate,
    });
    res.status(201).json({ id: result.id });
  } catch (err) {
    console.error(
      "Erreur lors de l'enregistrement de l'historique:",
      err.message || err
    );
    res
      .status(500)
      .json({ error: "Erreur lors de l'enregistrement de l'historique." });
  }
};
