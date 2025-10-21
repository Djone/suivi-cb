// backend/migrations/createRecurringTransactionsTable.js
const db = require('../config/db');

/**
 * Migration pour créer la table recurring_transactions
 * Cette table stocke les transactions récurrentes mensuelles pour le prévisionnel
 */
function createRecurringTransactionsTable() {
    const createTableQuery = `
    CREATE TABLE IF NOT EXISTS recurring_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      amount REAL NOT NULL,
      day_of_month INTEGER NOT NULL,
      sub_category_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      financial_flow_id INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`;

    return new Promise((resolve, reject) => {
        db.run(createTableQuery, (err) => {
            if (err) {
                console.error('Erreur lors de la création de la table recurring_transactions:', err.message);
                return reject(err);
            }
            console.log('✓ Table "recurring_transactions" vérifiée/créée avec succès.');
            resolve();
        });
    });
}

module.exports = createRecurringTransactionsTable;
