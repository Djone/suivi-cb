const db = require('../config/db');

const runQuery = (query, params = []) =>
  new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });

async function addColumnSafe(table, columnDef) {
  try {
    await runQuery(`ALTER TABLE ${table} ADD COLUMN ${columnDef};`);
    console.log(` -> Colonne ajoutée: ${table}.${columnDef}`);
  } catch (e) {
    // SQLite renvoie une erreur si la colonne existe déjà
    console.log(` -> Colonne déjà présente ou ignorée: ${table}.${columnDef}`);
  }
}

module.exports = async function migrate() {
  console.log('[Migration] Démarrage migration avancée récurrences (V1.1.0)');

  // Colonnes avancées pour recurring_transactions
  await addColumnSafe('recurring_transactions', 'occurrences INTEGER NULL');
  await addColumnSafe('recurring_transactions', 'active_months TEXT NULL');
  await addColumnSafe('recurring_transactions', "recurrence_kind TEXT NULL");

  // Table planned_transactions
  await runQuery(`
    CREATE TABLE IF NOT EXISTS planned_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      amount REAL NOT NULL,
      date DATE NOT NULL,
      account_id INTEGER NOT NULL,
      sub_category_id INTEGER NULL,
      financial_flow_id INTEGER NOT NULL,
      is_realized INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await runQuery(
    `CREATE INDEX IF NOT EXISTS idx_planned_date_account ON planned_transactions(date, account_id);`,
  );

  // Table recurring_transaction_history
  await runQuery(`
    CREATE TABLE IF NOT EXISTS recurring_transaction_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recurring_id INTEGER NOT NULL REFERENCES recurring_transactions(id) ON DELETE CASCADE,
      effective_from DATETIME NOT NULL,
      amount REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await runQuery(
    `CREATE INDEX IF NOT EXISTS idx_history_recurring ON recurring_transaction_history(recurring_id, effective_from);`,
  );

  console.log('[Migration] Fin migration avancée récurrences (V1.1.0)');
};
