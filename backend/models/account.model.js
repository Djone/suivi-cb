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

const Account = {
  // Récupérer tous les comptes
  getAll: async () => {
    const rows = await dbAll('SELECT * FROM accounts WHERE is_active = 1 ORDER BY id ASC');
    return rows.map(row => humps.camelizeKeys(row));
  },

  // Récupérer tous les comptes y compris les inactifs
  getAllIncludingInactive: async () => {
    const rows = await dbAll('SELECT * FROM accounts ORDER BY is_active DESC, id ASC');
    return rows.map(row => humps.camelizeKeys(row));
  },

  // Récupérer un compte par son ID
  getById: async (id) => {
    const row = await dbGet('SELECT * FROM accounts WHERE id = ?', [id]);
    if (!row) {
      throw new Error('Compte non trouvé');
    }
    return humps.camelizeKeys(row);
  },

  // Ajouter un nouveau compte
  add: async (account) => {
    const query = `
      INSERT INTO accounts (name, description, color, is_active)
      VALUES (?, ?, ?, ?)
    `;
    const params = [
      account.name,
      account.description || null,
      account.color || '#1976d2',
      account.isActive !== undefined ? account.isActive : 1
    ];
    console.log(`[DB_WRITE_DEBUG] Add operation on DB: "${db.filename}"`);
    const result = await dbRun(query, params);
    return { id: result.lastID };
  },

  // Mettre à jour un compte
  update: async (id, account) => {
    const query = `
      UPDATE accounts
      SET name = ?, description = ?, color = ?, is_active = ?
      WHERE id = ?
    `;
    const params = [
      account.name,
      account.description || null,
      account.color || '#1976d2',
      account.isActive !== undefined ? account.isActive : 1,
      id
    ];
    console.log(`[DB_WRITE_DEBUG] Update operation on DB: "${db.filename}"`);
    return await dbRun(query, params);
  },

  // Désactiver un compte (soft delete)
  deactivate: async (id) => {
    const query = 'UPDATE accounts SET is_active = 0 WHERE id = ?';
    console.log(`[DB_WRITE_DEBUG] Deactivate operation on DB: "${db.filename}"`);
    return await dbRun(query, [id]);
  },

  // Réactiver un compte
  reactivate: async (id) => {
    const query = 'UPDATE accounts SET is_active = 1 WHERE id = ?';
    console.log(`[DB_WRITE_DEBUG] Reactivate operation on DB: "${db.filename}"`);
    return await dbRun(query, [id]);
  }
};

module.exports = Account;
