const db = require('../config/db');
const logger = require('../utils/logger');

const HistoryModel = {
  getByRecurringId(recurringId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT id, recurring_id AS recurringId, effective_from AS effectiveFrom, amount, created_at AS createdAt
         FROM recurring_transaction_history
         WHERE recurring_id = ?
         ORDER BY datetime(effective_from) ASC, id ASC`,
        [recurringId],
        (err, rows) => {
          if (err) {
            logger.error('Erreur lors de la lecture de recurring_transaction_history');
            return reject(err);
          }
          resolve(rows || []);
        },
      );
    });
  },

  addEntry(entry) {
    const { recurringId, amount, effectiveFrom } = entry;
    if (!recurringId) {
      return Promise.reject(new Error('recurringId requis pour historiser'));
    }
    if (typeof amount !== 'number' || Number.isNaN(amount)) {
      return Promise.reject(new Error('amount invalide pour historiser'));
    }
    const effectiveDate = effectiveFrom ? new Date(effectiveFrom) : new Date();
    const query = `
      INSERT INTO recurring_transaction_history (recurring_id, amount, effective_from)
      VALUES (?, ?, ?)
    `;
    return new Promise((resolve, reject) => {
      db.run(query, [recurringId, amount, effectiveDate.toISOString()], function (err) {
        if (err) {
          logger.error('Erreur lors de la cr�ation d\'une entr�e d\'historique de r�currence');
          return reject(err);
        }
        resolve({ id: this.lastID });
      });
    });
  },
};

module.exports = HistoryModel;
