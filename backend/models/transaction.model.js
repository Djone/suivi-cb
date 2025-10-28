const humps = require('humps');
const db = require('../config/db');

// Fonctions utilitaires pour "promisifier" les méthodes de la base de données
const dbAll = (query, params = []) => new Promise((resolve, reject) => {
  db.all(query, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

const dbGet = (query, params = []) => new Promise((resolve, reject) => {
  db.get(query, params, (err, row) => (err ? reject(err) : resolve(row)));
});

const dbRun = (query, params = []) => new Promise((resolve, reject) => {
  db.run(query, params, function (err) { // Utiliser une fonction normale pour `this`
    if (err) return reject(err);
    resolve({ lastID: this.lastID, changes: this.changes });
  });
});

const Transaction = {
  // Récupérer toutes les transactions (avec jointures pour les détails)
  getAll: async () => {
    const query = `
      SELECT
        t.id,
        t.date,
        t.amount,
        t.description,
        t.sub_category_id,
        sc.label as sub_category_label,
        c.label as category_label,
        t.account_id,
        a.name as account_name,
        t.financial_flow_id
      FROM transactions t
      JOIN subcategories sc ON t.sub_category_id = sc.id
      JOIN categories c ON sc.category_id = c.id
      JOIN accounts a ON t.account_id = a.id
      ORDER BY t.date DESC, t.id DESC
    `;
    const rows = await dbAll(query);
    return rows.map(row => humps.camelizeKeys(row));
  },

  // Ajouter une nouvelle transaction
  add: async (transaction) => {
    const query = `
      INSERT INTO transactions (date, amount, description, sub_category_id, account_id, financial_flow_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const params = [
      transaction.date,
      transaction.amount,
      transaction.description,
      transaction.sub_category_id, // Correction: Utiliser snake_case
      transaction.account_id,      // Correction: Utiliser snake_case
      transaction.financial_flow_id // Correction: Utiliser snake_case
    ];
    console.log(`[DB_WRITE_DEBUG] Add operation on DB: "${db.filename}" (Transaction)`);
    const result = await dbRun(query, params);
    return { id: result.lastID };
  },

  // Mettre à jour une transaction
  update: async (id, transaction) => {
    const query = `
      UPDATE transactions
      SET date = ?, amount = ?, description = ?, sub_category_id = ?, account_id = ?, financial_flow_id = ?
      WHERE id = ?
    `;
    const params = [
      transaction.date,
      transaction.amount,
      transaction.description,
      transaction.sub_category_id,
      transaction.account_id,
      transaction.financial_flow_id,
      id
    ];
    console.log(`[DB_WRITE_DEBUG] Update operation on DB: "${db.filename}" (Transaction)`);
    return await dbRun(query, params);
  },

  // Supprimer une transaction par son ID
  deleteById: async (id) => {
    const query = 'DELETE FROM transactions WHERE id = ?';
    console.log(`[DB_WRITE_DEBUG] Delete operation on DB: "${db.filename}" (Transaction)`);
    return await dbRun(query, [id]);
  }
};

module.exports = Transaction;
