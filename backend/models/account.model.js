const humps = require('humps');
const db = require('../config/db');

const Account = {
  // Récupérer tous les comptes
  getAll: () => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM accounts WHERE is_active = 1 ORDER BY id ASC', [], (err, rows) => {
        if (err) {
          console.error('ACCOUNT MODEL : Erreur lors de la récupération des comptes', err.message);
          reject(err);
        } else {
          const camelCasedRows = rows.map(row => humps.camelizeKeys(row));
          console.log('ACCOUNT MODEL : Comptes récupérés avec succès', camelCasedRows);
          resolve(camelCasedRows);
        }
      });
    });
  },

  // Récupérer tous les comptes y compris les inactifs
  getAllIncludingInactive: () => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM accounts ORDER BY is_active DESC, id ASC', [], (err, rows) => {
        if (err) {
          console.error('ACCOUNT MODEL : Erreur lors de la récupération de tous les comptes', err.message);
          reject(err);
        } else {
          const camelCasedRows = rows.map(row => humps.camelizeKeys(row));
          console.log('ACCOUNT MODEL : Tous les comptes récupérés avec succès', camelCasedRows);
          resolve(camelCasedRows);
        }
      });
    });
  },

  // Récupérer un compte par son ID
  getById: (id) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM accounts WHERE id = ?', [id], (err, row) => {
        if (err) {
          console.error('ACCOUNT MODEL : Erreur lors de la récupération du compte', err.message);
          reject(err);
        } else if (!row) {
          console.error('ACCOUNT MODEL : Compte non trouvé');
          reject(new Error('Compte non trouvé'));
        } else {
          const camelCasedRow = humps.camelizeKeys(row);
          console.log('ACCOUNT MODEL : Compte récupéré avec succès', camelCasedRow);
          resolve(camelCasedRow);
        }
      });
    });
  },

  // Ajouter un nouveau compte
  add: (account) => {
    return new Promise((resolve, reject) => {
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

      db.run(query, params, function (err) {
        if (err) {
          console.error('ACCOUNT MODEL : Erreur lors de l\'ajout du compte', err.message);
          reject(err);
        } else {
          console.log('ACCOUNT MODEL : Compte ajouté avec succès, ID:', this.lastID);
          resolve({ id: this.lastID });
        }
      });
    });
  },

  // Mettre à jour un compte
  update: (id, account) => {
    return new Promise((resolve, reject) => {
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

      db.run(query, params, function (err) {
        if (err) {
          console.error('ACCOUNT MODEL : Erreur lors de la mise à jour du compte', err.message);
          reject(err);
        } else {
          console.log('ACCOUNT MODEL : Compte mis à jour avec succès');
          resolve({ changes: this.changes });
        }
      });
    });
  },

  // Désactiver un compte (soft delete)
  deactivate: (id) => {
    return new Promise((resolve, reject) => {
      const query = 'UPDATE accounts SET is_active = 0 WHERE id = ?';
      db.run(query, [id], function (err) {
        if (err) {
          console.error('ACCOUNT MODEL : Erreur lors de la désactivation du compte', err.message);
          reject(err);
        } else {
          console.log('ACCOUNT MODEL : Compte désactivé avec succès');
          resolve({ changes: this.changes });
        }
      });
    });
  },

  // Réactiver un compte
  reactivate: (id) => {
    return new Promise((resolve, reject) => {
      const query = 'UPDATE accounts SET is_active = 1 WHERE id = ?';
      db.run(query, [id], function (err) {
        if (err) {
          console.error('ACCOUNT MODEL : Erreur lors de la réactivation du compte', err.message);
          reject(err);
        } else {
          console.log('ACCOUNT MODEL : Compte réactivé avec succès');
          resolve({ changes: this.changes });
        }
      });
    });
  }
};

module.exports = Account;
