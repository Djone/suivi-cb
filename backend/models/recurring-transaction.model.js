// backend/models/recurring-transaction.model.js
const db = require('../config/db');
const logger = require('../utils/logger');

const RecurringTransaction = {

  // Liste toutes les transactions récurrentes (actives et inactives)
  getAll: () => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM recurring_transactions ORDER BY is_active DESC, day_of_month ASC', [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  },

  // Ajouter une transaction récurrente
  add: (recurringTransaction) => {
    const columns = ['label', 'amount', 'day_of_month', 'sub_category_id', 'account_id', 'financial_flow_id', 'frequency', 'debit_503020'];
    const values = columns.map((col) => recurringTransaction[col] || (col === 'frequency' ? 'monthly' : undefined));
    const placeholders = columns.map(() => '?').join(', ');

    return new Promise((resolve, reject) => {
      const query = `INSERT INTO recurring_transactions (${columns.join(', ')}) VALUES (${placeholders})`;

      db.run(query, values, function (err) {
        if (err) {
          logger.error('Erreur lors de la création de la transaction récurrente');
          reject(err);
        } else {
          logger.info('Nouvelle transaction récurrente ajoutée');
          resolve({ id: this.lastID });
        }
      });
    });
  },

  // Modifier une transaction récurrente
  update: (recurringTransaction) => {
    const { id, ...fieldsToUpdate } = recurringTransaction;

    const columns = Object.keys(fieldsToUpdate);
    if (columns.length === 0) {
      return Promise.reject(new Error('Aucun champ à mettre à jour.'));
    }

    const setClause = columns.map((col) => `${col} = ?`).join(', ');
    const query = `UPDATE recurring_transactions SET ${setClause} WHERE id = ?`;
    const values = [...columns.map((col) => fieldsToUpdate[col]), id];

    return new Promise((resolve, reject) => {
      db.run(query, values, function (err) {
        if (err) {
          logger.error('Erreur lors de la mise à jour de la transaction récurrente');
          return reject(err);
        }

        if (this.changes === 0) {
          return reject(new Error('Aucune transaction récurrente trouvée avec cet ID.'));
        }

        logger.info('Transaction récurrente mise à jour avec succès');
        resolve({ id, changes: this.changes });
      });
    });
  },

  // Soft delete d'une transaction récurrente (désactivation)
  deleteById: (id) => {
    return new Promise((resolve, reject) => {
      if (!id) {
        return reject(new Error('ID manquant pour la suppression de la transaction récurrente.'));
      }

      const query = 'UPDATE recurring_transactions SET is_active = 0 WHERE id = ?';
      db.run(query, [id], function (err) {
        if (err) {
          logger.error('Erreur lors de la désactivation de la transaction récurrente');
          return reject(err);
        }
        if (this.changes === 0) {
          return reject(new Error('Aucune transaction récurrente trouvée avec cet ID.'));
        }
        logger.info('Transaction récurrente désactivée avec succès');
        resolve();
      });
    });
  },

  // Réactiver une transaction récurrente
  reactivate: (id) => {
    return new Promise((resolve, reject) => {
      if (!id) {
        return reject(new Error('ID manquant pour la réactivation de la transaction récurrente.'));
      }

      const query = 'UPDATE recurring_transactions SET is_active = 1 WHERE id = ?';
      db.run(query, [id], function (err) {
        if (err) {
          logger.error('Erreur lors de la réactivation de la transaction récurrente');
          return reject(err);
        }
        if (this.changes === 0) {
          return reject(new Error('Aucune transaction récurrente trouvée avec cet ID.'));
        }
        logger.info('Transaction récurrente réactivée avec succès');
        resolve();
      });
    });
  },

  // Récupérer toutes les transactions récurrentes (actives et inactives)
  getAllIncludingInactive: () => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM recurring_transactions ORDER BY is_active DESC, day_of_month ASC', [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
};

module.exports = RecurringTransaction;
