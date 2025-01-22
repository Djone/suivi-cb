// backend/models/transaction.model.js
//Code retour
// 200: Succès.
// 201: Ressource créée.
// 400: Mauvaise requête.
// 404: Ressource introuvable.
// 500: Erreur serveur

const db = require('../config/db');
const logger = require('../utils/logger');

const Transaction = {
  
  getAll: (filters = {}) => {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM transactions WHERE 1 = 1'; // Clause de base
      const params = []; // Tableau pour stocker les paramètres de la requête
      const columnMap = { account_id: 'account_id', financial_flow_id: 'financial_flow_id' };

      console.log('Transaction model getAll (filters) : ', filters);

      // Si des filtres sont fournis, ajoutez-les à la requête
      Object.keys(filters).forEach((key) => {
        if (filters[key] !== undefined && filters[key] !== null) {
          const column = columnMap[key] || key; // Utilise le mapping ou la clé telle quelle
          query += ` AND ${column} = ?`; // Ajoute la condition dynamique
          params.push(filters[key]);   // Ajoute la valeur du filtre
        }
      });

      // Ajoutez l'ordre de tri par date (descendant) à la fin
      query += ' ORDER BY date DESC';

      console.log('Transaction model getAll params : ', params);
      console.log('Transaction model getAll : ', query);

      // Exécutez la requête avec les paramètres dynamiques
      db.all(query, params, (err, rows) => {
        if (err) {
          reject(err); // Rejeter la promesse en cas d'erreur
        } else {
          resolve(rows); // Résoudre la promesse avec les données récupérées
        }
      });
    });
  },

  /**
 * Ajoute une transcation à la base de données
 * @param {Object} transaction - Objet contenant les informations de la transaction
 * @returns {Promise<Object>} - Retourne l'ID de la transaction créée
 */
  add: (transaction) => {
    const columns = ['date', 'amount', 'description', 'sub_category_id', 'account_id', 'financial_flow_id']; // contient toutes les colonnes nécessaires pour l'insertion. Si vous devez ajouter ou modifier une colonne, il suffit de mettre à jour ce tableau.
    const values = columns.map((col) => transaction[col]); // Récupérer les valeurs correspondantes
    const placeholders = columns.map(() => '?').join(', '); // Génère "?, ?"

    return new Promise((resolve, reject) => {
      const query = `INSERT INTO transactions (${columns.join(', ')}) VALUES (${placeholders})`;

      console.log('Transaction model add : ', query);
      console.log('Transaction model add (data): ', values);

      db.run(query, values, function (err) {
        if (err) {
            logger.error('Erreur lors de la création de la transaction');
            reject(err); // Rejeter la promesse avec l'erreur
        } else {
            logger.info('Nouvelle transaction ajoutée');
            resolve({ id: this.lastID }); // Résoudre la promesse avec l'ID généré
        }
      });
    });
  },

  // Modification d'une categorie dans la table
  update: (transaction) => {
    const { id, ...fieldsToUpdate } = transaction;

    // Vérifier si des champs sont spécifiés pour la mise à jour
    const columns = Object.keys(fieldsToUpdate);
    if (columns.length === 0) {
        return Promise.reject(new Error('Aucun champ à mettre à jour.'));
    }

    // Génération dynamique de la requête SQL
    const setClause = columns.map((col) => `${col} = ?`).join(', ');
    const query = `UPDATE transactions SET ${setClause} WHERE id = ?`;
    logger.info(`UPDATE transactions SET ${setClause} WHERE id = ?`);

    // Préparation des valeurs pour la requête
    const values = [...columns.map((col) => fieldsToUpdate[col]), id];

    return new Promise((resolve, reject) => {
      db.run(query, values, function (err) {
          if (err) {
              logger.error('Erreur lors de la mise à jour de la transaction');
              return reject(err); // Rejeter la promesse avec une erreur SQL
          }

          if (this.changes === 0) {
              return reject(new Error('Aucune transaction trouvée avec cet ID.'));
          }

          console.log('Transaction mise à jour avec succès, ID :', id);
          logger.info('Transaction mise à jour avec succès');
          resolve({ id, changes: this.changes });
      });
    });
  },

  // Suppression d'une catégorie par ID
  deleteById: (id) => {
    return new Promise((resolve, reject) => {
        if (!id) {
            return reject(new Error('ID manquant pour la suppression de la transaction.'));
        }

        const query = 'DELETE FROM transactions WHERE ID = ?';
        db.run(query, [id], function (err) {
            if (err) {
                return reject(err); // Rejette la promesse si une erreur survient
            }
            if (this.changes === 0) {
                return reject(new Error('Aucune transaction trouvée avec cet ID.'));
            }
            resolve(); // Résout la promesse si la suppression est réussie
        });
    });
  } 
}; 

module.exports = Transaction;