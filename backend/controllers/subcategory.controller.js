// backend/controllers/subcategory.controller.js
// Le contrôleur se concentre sur le traitement des requêtes HTTP

// Code retour
// 200: Succès
// 201: Ressource créée
// 400: Mauvaise requête
// 404: Ressource introuvable
// 500: Erreur serveur

const subCategory = require("../models/subcategory.model");

exports.getAllSubCategories = async (req, res) => {
  try {
    const categories = await subCategory.getAll();
    res.status(200).json(categories);
  } catch (err) {
    console.error("Erreur lors de la récupération des sous-catégories :", err);
    res.status(500).json({ error: "Erreur interne du serveur" });
  }
};

exports.getAllSubCategoriesByfinancielFlowId = async (req, res) => {
  try {
    const { financialFlowId } = req.params; // ID extrait des paramètres de l'URL
    const categories =
      await subCategory.getAllByFinancialFlowId(financialFlowId);
    res.status(200).json(categories);
  } catch (err) {
    console.error("Erreur lors de la récupération des sous-catégories :", err);
    res.status(500).json({ error: "Erreur interne du serveur" });
  }
};

exports.addSubCategory = async (req, res) => {
  try {
    const newCategory = req.body;
    console.log("Requête reçue pour ajouter une sous-catégorie :", newCategory);

    // Appel au modèle pour insérer la catégorie
    const result = await subCategory.add(newCategory);

    // Retourner une réponse HTTP
    res.status(201).json({
      message: "Sous-catégorie ajoutée avec succès",
      id: result.id,
    });
  } catch (err) {
    console.error("Erreur lors de l’ajout de la sous-catégorie :", err);

    // Gestion des erreurs spécifiques
    if (err.code === "SQLITE_CONSTRAINT") {
      return res.status(400).json({
        error: "La sous-catégorie existe déjà ou les données sont invalides.",
      });
    }

    res.status(500).json({
      error: "Erreur interne du serveur lors de l’ajout de la sous-catégorie",
    });
  }
};

exports.updateSubCategory = async (req, res) => {
  try {
    const { id } = req.params; // ID extrait des paramètres de l'URL
    const fieldsToUpdate = req.body; // Champs de mise à jour

    if (!id) {
      return res
        .status(400)
        .json({ error: "ID de la sous-catégorie manquant." });
    }

    // Ajouter l'ID aux champs pour la mise à jour
    const updateData = { id, ...fieldsToUpdate };

    // Appel au modèle pour mettre à jour
    const result = await subCategory.update(updateData);

    res.status(200).json({
      message: "Sous-catégorie mise à jour avec succès.",
      updateData,
      changes: result.changes,
    });
  } catch (err) {
    console.error(
      "Erreur lors de la mise à jour de la sous-catégorie :",
      err.message || err
    );
    res.status(500).json({
      error:
        "Erreur interne du serveur lors de la mise à jour de la sous-catégorie.",
    });
  }
};

exports.deleteSubCategoryById = async (req, res) => {
  const id = parseInt(req.params.id, 10); // Conversion en entier pour garantir un traitement correct

  if (!id) {
    return res.status(400).json({ error: "ID invalide pour la suppression." });
  }

  try {
    await subCategory.deleteById(id);
    res.status(200).json({ message: "Sous-catégorie supprimée avec succès." });
  } catch (err) {
    console.error("Erreur lors de la suppression :", err.message);
    if (err.message === "Aucune sous-catégorie trouvée avec cet ID.") {
      return res.status(404).json({ error: err.message });
    }
    res
      .status(500)
      .json({ error: "Erreur lors de la suppression de la sous-catégorie." });
  }
};
