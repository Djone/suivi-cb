const SavingsWallet = require('../models/savings-wallet.model');
const Transaction = require('../models/transaction.model');

const parseNumber = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseFlow = (value) => {
  if (value === 'incoming' || value === 'outgoing') {
    return value;
  }
  return 'all';
};

const parseBoolean = (value) => {
  if (value === 'true' || value === '1' || value === true) {
    return true;
  }
  return false;
};

exports.getSavingsWallets = async (req, res) => {
  try {
    const includeClosed = parseBoolean(req.query.include_closed);
    const wallets = await SavingsWallet.getAll({ includeClosed });
    res.status(200).json(wallets);
  } catch (err) {
    console.error('Erreur lors de la récupération des portefeuilles:', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
};

exports.createSavingsWallet = async (req, res) => {
  try {
    const { name, target_amount } = req.body;
    const result = await SavingsWallet.create({
      name: String(name).trim(),
      targetAmount: Number(target_amount),
    });
    res.status(201).json({
      message: 'Portefeuille créé avec succès.',
      id: result.id,
    });
  } catch (err) {
    console.error('Erreur lors de la création du portefeuille:', err);
    if (err.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({
        error: 'Le portefeuille existe déjà ou les données sont invalides.',
      });
    }
    res
      .status(500)
      .json({ error: 'Erreur interne du serveur lors de la création.' });
  }
};

exports.updateSavingsWallet = async (req, res) => {
  try {
    const walletId = parseNumber(req.params.walletId);
    if (walletId === null) {
      return res.status(400).json({ error: 'ID de portefeuille invalide.' });
    }

    const { name, target_amount, is_active } = req.body;
    const updated = await SavingsWallet.update(walletId, {
      name: typeof name === 'string' ? name.trim() : undefined,
      targetAmount:
        target_amount !== undefined ? Number(target_amount) : undefined,
      isActive: is_active !== undefined ? parseBoolean(is_active) : undefined,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Portefeuille introuvable.' });
    }

    res.status(200).json({ message: 'Portefeuille mis à jour.' });
  } catch (err) {
    console.error('Erreur lors de la mise à jour du portefeuille:', err);
    if (err.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({
        error: 'Le portefeuille existe déjà ou les données sont invalides.',
      });
    }
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
};

exports.getWalletAllocationSummary = async (req, res) => {
  try {
    const filters = {
      accountId: parseNumber(req.query.account_id),
      year: parseNumber(req.query.year),
      month: parseNumber(req.query.month),
      flow: parseFlow(req.query.flow),
      includeClosed: parseBoolean(req.query.include_closed),
    };
    const summary = await SavingsWallet.getAllocationSummary(filters);
    res.status(200).json(summary);
  } catch (err) {
    console.error(
      'Erreur lors de la récupération du récapitulatif de portefeuilles:',
      err,
    );
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
};

exports.getAllocationsForTransaction = async (req, res) => {
  try {
    const transactionId = parseNumber(req.params.transactionId);
    if (transactionId === null) {
      return res.status(400).json({ error: 'ID de transaction invalide.' });
    }
    const allocations = await SavingsWallet.getAllocationsByTransaction(transactionId);
    res.status(200).json(allocations);
  } catch (err) {
    console.error(
      'Erreur lors de la récupération des allocations de la transaction:',
      err,
    );
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
};

exports.getAllocationsForTransactions = async (req, res) => {
  try {
    const { transaction_ids } = req.body || {};
    const allocations =
      await SavingsWallet.getAllocationsByTransactions(transaction_ids);
    res.status(200).json(allocations);
  } catch (err) {
    console.error(
      'Erreur lors de la récupération des allocations de transactions:',
      err,
    );
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
};

exports.setTransactionAllocations = async (req, res) => {
  try {
    const { transaction_id, allocations = [] } = req.body;
    const transactionId = parseNumber(transaction_id);
    if (transactionId === null) {
      return res.status(400).json({ error: 'transaction_id invalide.' });
    }

    const transaction = await Transaction.getById(transactionId);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction introuvable.' });
    }

    if (!transaction.isInternalTransfer && !transaction.is_internal_transfer) {
      return res
        .status(400)
        .json({ error: 'La transaction doit être un transfert interne.' });
    }

    const normalizedAllocations = Array.isArray(allocations)
      ? allocations
          .map((allocation) => ({
            walletId: parseNumber(allocation.wallet_id),
            amount: parseNumber(allocation.amount),
          }))
          .filter(
            (allocation) =>
              allocation.walletId !== null &&
              allocation.amount !== null &&
              allocation.amount >= 0,
          )
      : [];

    const total = normalizedAllocations.reduce(
      (sum, allocation) => sum + allocation.amount,
      0,
    );
    const maxAmount = Math.abs(transaction.amount || 0);
    if (total - maxAmount > 0.0001) {
      return res.status(400).json({
        error: "Le total alloué dépasse le montant de la transaction.",
      });
    }

    await SavingsWallet.setTransactionAllocations(
      transactionId,
      normalizedAllocations,
    );

    res.status(200).json({ message: 'Affectations enregistrées.' });
  } catch (err) {
    console.error("Erreur lors de l'enregistrement des allocations:", err);
    if (err.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({
        error:
          "Une allocation référence un portefeuille invalide ou une règle d'intégrité a été violée.",
      });
    }
    res
      .status(500)
      .json({ error: "Erreur interne du serveur lors de l'enregistrement." });
  }
};

exports.closeSavingsWallet = async (req, res) => {
  try {
    const walletId = parseNumber(req.params.walletId);
    if (walletId === null) {
      return res.status(400).json({ error: 'ID de portefeuille invalide.' });
    }

    const updated = await SavingsWallet.closeWallet(walletId);
    if (!updated) {
      return res.status(404).json({ error: 'Portefeuille introuvable.' });
    }

    res.status(200).json({ message: 'Portefeuille clôturé.' });
  } catch (err) {
    console.error('Erreur lors de la clôture du portefeuille:', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
};

exports.deleteSavingsWallet = async (req, res) => {
  try {
    const walletId = parseNumber(req.params.walletId);
    if (walletId === null) {
      return res.status(400).json({ error: 'ID de portefeuille invalide.' });
    }

    const deleted = await SavingsWallet.delete(walletId);
    if (!deleted) {
      return res.status(404).json({ error: 'Portefeuille introuvable.' });
    }

    res.status(200).json({ message: 'Portefeuille supprimé.' });
  } catch (err) {
    console.error('Erreur lors de la suppression du portefeuille:', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
};
