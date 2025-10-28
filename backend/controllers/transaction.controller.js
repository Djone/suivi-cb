// backend/controllers/transaction.controller.js
// Code retour
// 200: Succès
// 201: Ressource créée
// 400: Mauvaise requête
// 404: Ressource introuvable
// 500: Erreur serveur

const Transaction = require('../models/transaction.model');

exports.getAllTransactions = async (req, res) => {
    try {
        const transactions = await Transaction.getAll(req.query);
        console.log('Transactions récupérées :', req.query);
        res.status(200).json(transactions);
    } catch (err) {
        console.error('Erreur lors de la récupération des transactions :', err);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
};

exports.addTransaction = async (req, res) => {
    try {
        const newTransaction = req.body; 
        
        // Conversion de la date au format YYYY-MM-DD
        if (newTransaction.date) {
            const date = new Date(newTransaction.date);
            newTransaction.date = date.toLocaleDateString('en-CA'); // Format ISO (YYYY-MM-DD)
        }

        console.log('Requête reçue pour ajouter une catégorie :', newTransaction);

        // Appel au modèle pour insérer la catégorie
        const result = await Transaction.add(newTransaction);
        
        // Retourner une réponse HTTP
        res.status(201).json({ 
            message: 'Transaction ajoutée avec succès', 
            id: result.id 
        });
    } catch (err) {
        console.error('Erreur lors de l’ajout de la transaction :', err);
        
        // Gestion des erreurs spécifiques
        if (err.code === 'SQLITE_CONSTRAINT') {
            return res.status(400).json({ 
                error: 'La transaction existe déjà ou les données sont invalides.' 
            });
        }

        res.status(500).json({
            error: 'Erreur interne du serveur lors de l’ajout de la transaction'
        });
    }
};

exports.updateTransaction = async (req, res) => {
    try {
        const { id } = req.params; // ID extrait des paramètres de l'URL
        const fieldsToUpdate = req.body; // Champs de mise à jour

        // Conversion de la date au format YYYY-MM-DD
        if (fieldsToUpdate.date) {
            const date = new Date(fieldsToUpdate.date);
            fieldsToUpdate.date = date.toLocaleDateString('en-CA'); // Format ISO (YYYY-MM-DD)
        }

        console.log('ID reçu de la transaction:', id); // Log de l'ID
        console.log('Données reçues pour mise à jour de la transaction:', fieldsToUpdate); // Log des données du corps

        if (!id) {
            return res.status(400).json({ error: 'ID de la transaction manquant.' });
        }

        // Appel au modèle pour mettre à jour
        const result = await Transaction.update(id, fieldsToUpdate);

        res.status(200).json({
            message: 'Transaction mise à jour avec succès.',
            changes: result.changes,
        });
    } catch (err) {
        console.error('Erreur lors de la mise à jour de la transaction :', err.message || err);
        res.status(500).json({
            error: 'Erreur interne du serveur lors de la mise à jour de la transaction.',
        });
    }
};
  
exports.deleteTransactionById = async (req, res) => {
    const id = parseInt(req.params.id, 10); // Conversion en entier pour garantir un traitement correct

    if (!id) {
        return res.status(400).json({ error: 'ID invalide pour la suppression de la transaction.' });
    }

    try {
        await Transaction.deleteById(id);
        res.status(200).json({ message: 'Transaction supprimée avec succès.' });
    } catch (err) {
        console.error('Erreur lors de la suppression de la transaction :', err.message);
        if (err.message === 'Aucune transaction trouvée avec cet ID.') {
            return res.status(404).json({ error: err.message });
        }
        res.status(500).json({ error: 'Erreur lors de la suppression de la transaction.' });
    }
};