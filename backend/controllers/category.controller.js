// backend/controllers/category.controller.js
// Le contrôleur se concentre sur le traitement des requêtes HTTP

// Code retour
// 200: Succès
// 201: Ressource créée
// 400: Mauvaise requête
// 404: Ressource introuvable
// 500: Erreur serveur

const Category = require('../models/category.model');

exports.getAllCategories = async (req, res) => {
    try {
        const categories = await Category.getAll();
        console.log('Catégories récupérées :', categories);
        res.status(200).json(categories);
    } catch (err) {
        console.error('Erreur lors de la récupération des catégories :', err);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
};

exports.addCategory = async (req, res) => {
    try {
        const newCategory = req.body;
        console.log('Requête reçue pour ajouter une catégorie :', newCategory); 
        
        // Appel au modèle pour insérer la catégorie
        const result = await Category.add(newCategory);
        
        // Retourner une réponse HTTP
        res.status(201).json({ 
            message: 'Catégorie ajoutée avec succès', 
            id: result.id 
        });
    } catch (err) {
        console.error('Erreur lors de l’ajout de la catégorie :', err);
        
        // Gestion des erreurs spécifiques
        if (err.code === 'SQLITE_CONSTRAINT') {
            return res.status(400).json({ 
                error: 'La catégorie existe déjà ou les données sont invalides.' 
            });
        }

        res.status(500).json({
            error: 'Erreur interne du serveur lors de l’ajout de la catégorie'
        });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params; // ID extrait des paramètres de l'URL
        const fieldsToUpdate = req.body; // Champs de mise à jour

        console.log('ID reçu de la catégorie :', id); // Log de l'ID
        console.log('Données reçues pour mise à jour de la catégorie :', req.body); // Log des données du corps

        if (!id) {
            return res.status(400).json({ error: 'ID de la catégorie manquant.' });
        }

        // Ajouter l'ID aux champs pour la mise à jour
        const updateData = { id, ...fieldsToUpdate };

        // Appel au modèle pour mettre à jour
        const result = await Category.update(updateData);

        res.status(200).json({
            message: 'Catégorie mise à jour avec succès.', updateData,
            changes: result.changes,
        });
    } catch (err) {
        console.error('Erreur lors de la mise à jour de la catégorie :', err.message || err);
        res.status(500).json({
            error: 'Erreur interne du serveur lors de la mise à jour de la catégorie.',
        });
    }
};
  
exports.deleteCategoryById = async (req, res) => {
    const id = parseInt(req.params.id, 10); // Conversion en entier pour garantir un traitement correct

    if (!id) {
        return res.status(400).json({ error: 'ID invalide pour la suppression.' });
    }

    try {
        await Category.deleteById(id);
        res.status(200).json({ message: 'Catégorie supprimée avec succès.' });
    } catch (err) {
        console.error('Erreur lors de la suppression de la catégorie :', err.message);
        if (err.message === 'Aucune catégorie trouvée avec cet ID.') {
            return res.status(404).json({ error: err.message });
        }
        res.status(500).json({ error: 'Erreur lors de la suppression de la catégorie.' });
    }
};