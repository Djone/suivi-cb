// backend/models/category.model.js
// Le modèle se charge de l'accès aux données

//Accès à la base de données SQLite3
const db = require('../config/db');
const logger = require('../utils/logger');

const Category = {
  
  //Liste toutes les categories
  getAll: () => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM categories', [], (err, rows) => {
        if (err) {
          reject(err); // Rejetez la promesse en cas d'erreur
        } else {
          resolve(rows); // Résolvez la promesse avec les données
        }
      });
    });
  },

  /**
   * Ajoute une catégorie à la base de données
   * @param {Object} category - Objet contenant les informations de la catégorie
   * @returns {Promise<Object>} - Retourne l'ID de la catégorie créée
   */
  add: (category) => {
    const columns = ['label', 'financial_flow_id']; // contient toutes les colonnes nécessaires pour l'insertion. Si vous devez ajouter ou modifier une colonne, il suffit de mettre à jour ce tableau.
    const values = columns.map((col) => category[col]); // Récupérer les valeurs correspondantes
    const placeholders = columns.map(() => '?').join(', '); // Génère "?, ?"
    
    return new Promise((resolve, reject) => {
      const query = `INSERT INTO categories (${columns.join(', ')}) VALUES (${placeholders})`;

      db.run(query, values, function (err) {
        if (err) {
            logger.error('Erreur lors de la création de la catégorie');
            reject(err); // Rejeter la promesse avec l'erreur
        } else {
            logger.info('Nouvelle catégorie ajoutée');
            resolve({ id: this.lastID }); // Résoudre la promesse avec l'ID généré
        }
      });
    });
  },

  // Modification d'une categorie dans la table
  update: (category) => {
    const { id, ...fieldsToUpdate } = category;

    // Vérifier si des champs sont spécifiés pour la mise à jour
    const columns = Object.keys(fieldsToUpdate);
    if (columns.length === 0) {
        return Promise.reject(new Error('Aucun champ à mettre à jour.'));
    }

    // Génération dynamique de la requête SQL
    const setClause = columns.map((col) => `${col} = ?`).join(', ');
    const query = `UPDATE categories SET ${setClause} WHERE id = ?`;
    logger.info(`UPDATE categories SET ${setClause} WHERE id = ?`);

    // Préparation des valeurs pour la requête
    const values = [...columns.map((col) => fieldsToUpdate[col]), id];

    return new Promise((resolve, reject) => {
      db.run(query, values, function (err) {
          if (err) {
              logger.error('Erreur lors de la mise à jour de la catégorie');
              return reject(err); // Rejeter la promesse avec une erreur SQL
          }

          if (this.changes === 0) {
              return reject(new Error('Aucune catégorie trouvée avec cet ID.'));
          }

          console.log('Catégorie mise à jour avec succès, ID :', id);
          logger.info('Catégorie mise à jour avec succès');
          resolve({ id, changes: this.changes });
      });
    });
  },

  // Suppression d'une catégorie par ID
  deleteById: (id) => {
    return new Promise((resolve, reject) => {
        if (!id) {
            return reject(new Error('ID manquant pour la suppression de la catégorie.'));
        }

        const query = 'DELETE FROM categories WHERE ID = ?';
        db.run(query, [id], function (err) {
            if (err) {
                return reject(err); // Rejette la promesse si une erreur survient
            }
            if (this.changes === 0) {
                return reject(new Error('Aucune catégorie trouvée avec cet ID.'));
            }
            resolve(); // Résout la promesse si la suppression est réussie
        });
    });
  } 
};

module.exports = Category;