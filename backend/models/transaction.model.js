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
  getAll: async (filters = {}) => {
    const normalizedFilters = humps.decamelizeKeys(filters || {});
    const allowedFilters = {
      category_id: 'c.id',
      sub_category_id: 't.sub_category_id',
      account_id: 't.account_id',
      financial_flow_id: 't.financial_flow_id',
    };

    const conditions = [];
    const params = [];

    Object.entries(allowedFilters).forEach(([key, column]) => {
      const rawValue = normalizedFilters[key];

      if (
        rawValue === undefined ||
        rawValue === null ||
        rawValue === '' ||
        Number.isNaN(Number(rawValue))
      ) {
        return;
      }

      conditions.push(`${column} = ?`);
      params.push(Number(rawValue));
    });

    let query = `
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
        t.financial_flow_id,
        t.recurring_transaction_id
      FROM transactions t
      LEFT JOIN subcategories sc ON t.sub_category_id = sc.id
      LEFT JOIN categories c ON sc.category_id = c.id
      LEFT JOIN accounts a ON t.account_id = a.id
    `;

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY t.date DESC, t.id DESC';

    const rows = await dbAll(query, params);
    return rows.map((row) => humps.camelizeKeys(row));
  },

  // Ajouter une nouvelle transaction
  add: async (transaction) => {
    const query = `
      INSERT INTO transactions (date, amount, description, sub_category_id, account_id, financial_flow_id, recurring_transaction_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      transaction.date,
      transaction.amount,
      transaction.description,
      transaction.sub_category_id, // Correction: Utiliser snake_case
      transaction.account_id,      // Correction: Utiliser snake_case
      transaction.financial_flow_id, // Correction: Utiliser snake_case
      transaction.recurring_transaction_id
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
