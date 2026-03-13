const humps = require('humps');
const db = require('../config/db');

// Fonctions utilitaires pour "promisifier" les mÃ©thodes de la base de donnÃ©es
const dbAll = (query, params = []) => new Promise((resolve, reject) => {
  db.all(query, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

const dbGet = (query, params = []) => new Promise((resolve, reject) => {
  db.get(query, params, (err, row) => (err ? reject(err) : resolve(row)));
});

const dbRun = (query, params = []) => new Promise((resolve, reject) => {
  db.run(query, params, function (err) {
    if (err) return reject(err);
    resolve({ lastID: this.lastID, changes: this.changes });
  });
});

const toDbBoolean = (value) => {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return value === 1 ? 1 : 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' ? 1 : 0;
  }
  return 0;
};

const Transaction = {
  // RÃ©cupÃ©rer toutes les transactions (avec jointures pour les dÃ©tails)
  getAll: async (filters = {}) => {
    const normalizedFilters = humps.decamelizeKeys(filters || {});
    const allowedFilters = {
      category_id: 'c.id',
      sub_category_id: 't.sub_category_id',
      account_id: 't.account_id',
      financial_flow_id: 't.financial_flow_id',
      is_internal_transfer: 't.is_internal_transfer',
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
        t.recurring_transaction_id,
        t.advance_to_joint_account,
        t.is_internal_transfer
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
      INSERT INTO transactions (date, amount, description, sub_category_id, account_id, financial_flow_id, recurring_transaction_id, advance_to_joint_account, is_internal_transfer)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      transaction.date,
      transaction.amount,
      transaction.description,
      transaction.sub_category_id,
      transaction.account_id,
      transaction.financial_flow_id,
      transaction.recurring_transaction_id,
      toDbBoolean(transaction.advance_to_joint_account),
      toDbBoolean(transaction.is_internal_transfer),
    ];
    console.log(`[DB_WRITE_DEBUG] Add operation on DB: "${db.filename}" (Transaction)`);
    const result = await dbRun(query, params);
    return { id: result.lastID };
  },

  // Mettre Ã  jour une transaction
  update: async (id, transaction) => {
    let targetId = id;
    let payload = transaction;

    // Compat backward: update({ id, ...fields }) and update(id, fields)
    if (typeof transaction === 'undefined' && id && typeof id === 'object') {
      targetId = id.id;
      payload = { ...id };
      delete payload.id;
    }

    if (!targetId) {
      throw new Error('ID de la transaction manquant.');
    }

    const fields = [];
    const params = [];
    const allowed = [
      'date',
      'amount',
      'description',
      'sub_category_id',
      'account_id',
      'financial_flow_id',
      'advance_to_joint_account',
      'is_internal_transfer',
    ];

    for (const key of allowed) {
      if (!payload || typeof payload[key] === 'undefined') {
        continue;
      }

      if (key === 'advance_to_joint_account' || key === 'is_internal_transfer') {
        fields.push(`${key} = ?`);
        params.push(toDbBoolean(payload[key]));
        continue;
      }

      fields.push(`${key} = ?`);
      params.push(payload[key]);
    }

    if (fields.length === 0) {
      throw new Error('Aucun champ Ã  mettre Ã  jour.');
    }

    const query = `
      UPDATE transactions
      SET ${fields.join(', ')}
      WHERE id = ?
    `;
    params.push(targetId);
    console.log(`[DB_WRITE_DEBUG] Update operation on DB: "${db.filename}" (Transaction)`);
    const result = await dbRun(query, params);
    if (!result.changes) {
      throw new Error('Aucune transaction trouvÃ©e avec cet ID.');
    }
    return { id: Number(targetId), changes: result.changes };
  },

  // Supprimer une transaction par son ID
  deleteById: async (id) => {
    if (!id) {
      throw new Error('ID manquant pour la suppression de la transaction.');
    }
    const query = 'DELETE FROM transactions WHERE id = ?';
    console.log(`[DB_WRITE_DEBUG] Delete operation on DB: "${db.filename}" (Transaction)`);
    const result = await dbRun(query, [id]);
    if (!result.changes) {
      throw new Error('Aucune transaction trouvÃ©e avec cet ID.');
    }
    return undefined;
  },

  getById: async (id) => {
    const parsedId = Number(id);
    if (!Number.isFinite(parsedId)) {
      return null;
    }

    const row = await dbGet(
      `
      SELECT
        id,
        amount,
        is_internal_transfer
      FROM transactions
      WHERE id = ?
    `,
      [parsedId],
    );

    if (!row) {
      return null;
    }

    return {
      id: Number(row.id),
      amount: Number(row.amount),
      isInternalTransfer: Number(row.is_internal_transfer) === 1,
    };
  },
};

module.exports = Transaction;

