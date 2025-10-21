// backend/models/subcategory.model.js
// Le modèle se charge de l'accès aux données

//Accès à la base de données SQLite3
const db = require('../config/db');
const logger = require('../utils/logger');

const SubCategory = {
  
  //Liste toutes les categories
  getAll: (filters = {}) => {
    return new Promise((resolve, reject) => {
      db.all(`
          SELECT 
                subcategories.id AS id,
                subcategories.label AS label,
                subcategories.category_id AS categoryId,
                categories.label AS categoryLabel
            FROM 
                subcategories
            JOIN 
                categories
            ON 
                subcategories.category_id = categories.id
      `, [], (err, rows) => {
        if (err) {
          reject(err); // Rejetez la promesse en cas d'erreur
        } else {
          resolve(rows); // Résolvez la promesse avec les données
        }
      });
    });
  },

  //Liste toutes les categories par type de flux financier (débit, crédit)
  getAllByFinancialFlowId: (financial_flow_id) => {
    return new Promise((resolve, reject) => {
      db.all('SELECT sc.id, sc.label FROM subcategories sc, categories c where sc.category_id = c.id AND c.financial_flow_id = ?', [financial_flow_id], (err, rows) => {
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
   * @param {Object} subcategory - Objet contenant les informations de la catégorie
   * @returns {Promise<Object>} - Retourne l'ID de la catégorie créée
   */
  add: (subcategory) => {
    const columns = ['label', 'category_id']; // contient toutes les colonnes nécessaires pour l'insertion. Si vous devez ajouter ou modifier une colonne, il suffit de mettre à jour ce tableau.
    const values = columns.map((col) => subcategory[col]); // Récupérer les valeurs correspondantes
    const placeholders = columns.map(() => '?').join(', '); // Génère "?, ?"
    
    return new Promise((resolve, reject) => {
      const query = `INSERT INTO subcategories (${columns.join(', ')}) VALUES (${placeholders})`;

      db.run(query, values, function (err) {
        if (err) {
            logger.error('Erreur lors de la création de la sous-catégorie');
            reject(err); // Rejeter la promesse avec l'erreur
        } else {
            logger.info('Nouvelle sous-catégorie ajoutée');
            resolve({ id: this.lastID }); // Résoudre la promesse avec l'ID généré
        }
      });
    });
  },

  // Modification d'une categorie dans la table
  update: (subCategory) => {
    const { id, ...fieldsToUpdate } = subCategory;

    // Vérifier si des champs sont spécifiés pour la mise à jour
    const columns = Object.keys(fieldsToUpdate);
    if (columns.length === 0) {
        return Promise.reject(new Error('Aucun champ à mettre à jour.'));
    }

    // Génération dynamique de la requête SQL
    const setClause = columns.map((col) => `${col} = ?`).join(', ');
    const query = `UPDATE subcategories SET ${setClause} WHERE id = ?`;
    logger.info(`UPDATE subcategories SET ${setClause} WHERE id = ?`);

    // Préparation des valeurs pour la requête
    const values = [...columns.map((col) => fieldsToUpdate[col]), id];

    return new Promise((resolve, reject) => {
      db.run(query, values, function (err) {
          if (err) {
              logger.error('Erreur lors de la mise à jour de la sous-catégorie');
              return reject(err); // Rejeter la promesse avec une erreur SQL
          }

          if (this.changes === 0) {
              return reject(new Error('Aucune sous-catégorie trouvée avec cet ID.'));
          }

          logger.info('Sous-catégorie mise à jour avec succès');
          resolve({ id, changes: this.changes });
      });
    });
  },

  // Suppression d'une catégorie par ID
  deleteById: (id) => {
    return new Promise((resolve, reject) => {
        if (!id) {
            return reject(new Error('ID manquant pour la suppression.'));
        }

        const query = 'DELETE FROM subcategories WHERE ID = ?';
        db.run(query, [id], function (err) {
            if (err) {
                return reject(err); // Rejette la promesse si une erreur survient
            }
            if (this.changes === 0) {
                return reject(new Error('Aucune sous-catégorie trouvée avec cet ID.'));
            }
            resolve(); // Résout la promesse si la suppression est réussie
        });
    });
  } 
};

module.exports = SubCategory;