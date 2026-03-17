const db = require("../config/db");

// Fonctions utilitaires pour transformer les callbacks en Promises
const runQuery = (query, params = []) =>
  new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });

const getQuery = (query, params = []) =>
  new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });

const allQuery = (query, params = []) =>
  new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

const normalizeLabel = (value) =>
  (value || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const ensureSavingsSystemData = async () => {
  const categories = await allQuery(
    'SELECT id, label, financial_flow_id, is_active FROM categories',
  );

  for (const financialFlowId of [1, 2]) {
    let category = categories.find(
      (item) =>
        Number(item.financial_flow_id) === financialFlowId &&
        normalizeLabel(item.label) === 'epargne',
    );

    if (!category) {
      const result = await runQuery(
        'INSERT INTO categories (label, financial_flow_id, is_active) VALUES (?, ?, 1)',
        ['Épargne', financialFlowId],
      );
      category = {
        id: result.lastID,
        label: 'Épargne',
        financial_flow_id: financialFlowId,
        is_active: 1,
      };
      categories.push(category);
    } else if (Number(category.is_active) !== 1) {
      await runQuery('UPDATE categories SET is_active = 1 WHERE id = ?', [
        category.id,
      ]);
    }

    const subCategories = await allQuery(
      'SELECT id, label FROM subcategories WHERE category_id = ?',
      [category.id],
    );
    const hasInternalTransfer = (subCategories || []).some(
      (subCategory) => normalizeLabel(subCategory.label) === 'transfert interne',
    );
    if (!hasInternalTransfer) {
      await runQuery(
        'INSERT INTO subcategories (label, category_id) VALUES (?, ?)',
        ['Transfert interne', category.id],
      );
    }
  }
};

// Fonction principale d'initialisation, maintenant asynchrone
const initializeDatabase = async () => {
  try {
    console.log("🚀 Démarrage des migrations de la base de données...");

    await runQuery(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date DATE NOT NULL,
        amount REAL NOT NULL,
        description TEXT NOT NULL,
        sub_category_id INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        financial_flow_id INTEGER NOT NULL,
        recurring_transaction_id INTEGER NULL REFERENCES recurring_transactions(id) ON DELETE SET NULL,
        advance_to_joint_account INTEGER NOT NULL DEFAULT 0
      );
    `);
    await runQuery(
      `ALTER TABLE transactions ADD COLUMN advance_to_joint_account INTEGER NOT NULL DEFAULT 0;`
    ).catch(() => {});
    await runQuery(
      `ALTER TABLE transactions ADD COLUMN is_internal_transfer INTEGER NOT NULL DEFAULT 0;`
    ).catch(() => {});
    console.log('✓ Table "transactions" vérifiée/créée.');

    await runQuery(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL, 
        financial_flow_id INTEGER,
        is_active INTEGER DEFAULT 1
      );
    `);
    console.log('✓ Table "categories" vérifiée/créée.');

    await runQuery(`
      CREATE TABLE IF NOT EXISTS subcategories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category_id INTEGER NOT NULL,
          label TEXT NOT NULL
      );
    `);
    await ensureSavingsSystemData();
    console.log('✓ Table "subcategories" vérifiée/créée.');

    await runQuery(`
      CREATE TABLE IF NOT EXISTS recurring_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL,
        amount REAL NOT NULL,
        day_of_month INTEGER NOT NULL,
        sub_category_id INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        financial_flow_id INTEGER NOT NULL,
        debit_503020 INTEGER,
        frequency TEXT NOT NULL DEFAULT 'monthly',
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Table "recurring_transactions" vérifiée/créée.');
    // Ajout non bloquant de colonnes avancées (si non présentes)
    await runQuery(
      `ALTER TABLE recurring_transactions ADD COLUMN start_month INTEGER NULL;`
    ).catch(() => {});
    await runQuery(
      `ALTER TABLE recurring_transactions ADD COLUMN occurrences INTEGER NULL;`
    ).catch(() => {});
    await runQuery(
      `ALTER TABLE recurring_transactions ADD COLUMN active_months TEXT NULL;`
    ).catch(() => {});
    await runQuery(
      `ALTER TABLE recurring_transactions ADD COLUMN recurrence_kind TEXT NULL;`
    ).catch(() => {});
    console.log(
      "-> Colonnes avancées sur recurring_transactions vérifiées/ajoutées."
    );

    await runQuery(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT DEFAULT '#1976d2',
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Table "accounts" vérifiée/créée.');

    await runQuery(`
      CREATE TABLE IF NOT EXISTS savings_wallets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        target_amount REAL NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await runQuery(
      `ALTER TABLE savings_wallets ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;`
    ).catch(() => {});
    await runQuery(
      `UPDATE savings_wallets SET is_active = 1 WHERE is_active IS NULL;`
    ).catch(() => {});
    await runQuery(
      `ALTER TABLE savings_wallets ADD COLUMN closed_target_amount REAL;`
    ).catch(() => {});
    await runQuery(
      `ALTER TABLE savings_wallets ADD COLUMN closed_allocated_amount REAL;`
    ).catch(() => {});
    await runQuery(
      `ALTER TABLE savings_wallets ADD COLUMN closed_remaining_amount REAL;`
    ).catch(() => {});
    await runQuery(`
      UPDATE savings_wallets
      SET
        closed_target_amount = target_amount,
        closed_allocated_amount = COALESCE((
          SELECT SUM(swa.amount)
          FROM savings_wallet_allocations swa
          WHERE swa.wallet_id = savings_wallets.id
        ), 0),
        closed_remaining_amount = target_amount - COALESCE((
          SELECT SUM(swa.amount)
          FROM savings_wallet_allocations swa
          WHERE swa.wallet_id = savings_wallets.id
        ), 0)
      WHERE is_active = 0
        AND (
          closed_target_amount IS NULL
          OR closed_allocated_amount IS NULL
          OR closed_remaining_amount IS NULL
        );
    `).catch(() => {});
    console.log('✓ Table "savings_wallets" vérifiée/créée.');

    await runQuery(`
      CREATE TABLE IF NOT EXISTS savings_wallet_allocations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id INTEGER NOT NULL,
        wallet_id INTEGER NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(transaction_id, wallet_id),
        FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
        FOREIGN KEY (wallet_id) REFERENCES savings_wallets(id) ON DELETE CASCADE
      );
    `);
    console.log('✓ Table "savings_wallet_allocations" vérifiée/créée.');
    // Insertion des comptes par défaut si la table est vide
    const row = await getQuery("SELECT COUNT(*) as count FROM accounts");
    if (row && row.count === 0) {
      console.log("-> Aucun compte trouvé, création des comptes par défaut...");
      await runQuery(
        `INSERT INTO accounts (id, name, description, color, is_active)
         VALUES (1, 'Compte courant', 'Compte bancaire principal', '#1976d2', 1)`
      );
      console.log("✓ Compte courant créé.");

      await runQuery(
        `INSERT INTO accounts (id, name, description, color, is_active)
         VALUES (2, 'Compte joint', 'Compte bancaire joint', '#4caf50', 1)`
      );
      console.log("✓ Compte joint créé.");
    } else {
      console.log("-> Des comptes existent déjà, aucune insertion nécessaire.");
    }

    const internalTransferAccount = await getQuery(
      `SELECT id FROM accounts WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1`,
      ['Transfert interne'],
    );
    if (!internalTransferAccount) {
      await runQuery(
        `INSERT INTO accounts (name, description, color, is_active)
         VALUES (?, ?, ?, ?)`,
        [
          'Transfert interne',
          'Compte systeme pour les depots et retraits internes d epargne',
          '#64748b',
          0,
        ],
      );
      console.log('Compte systeme "Transfert interne" cree.');
    }

    await runQuery(`
      CREATE TABLE IF NOT EXISTS couple_split_configs (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        members_json TEXT NOT NULL,
        lines_json TEXT NOT NULL,
        custom_prorata_a REAL NOT NULL DEFAULT 50,
        ignored_recurring_ids TEXT NOT NULL DEFAULT '[]',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('�o" Table "couple_split_configs" vérifiée/créée.');
    await runQuery(
      `ALTER TABLE couple_split_configs ADD COLUMN ignored_recurring_ids TEXT NOT NULL DEFAULT '[]';`,
    ).catch(() => {});
    const coupleSplitRow = await getQuery("SELECT COUNT(*) as count FROM couple_split_configs");
    if (coupleSplitRow && coupleSplitRow.count === 0) {
      const defaultMembers = JSON.stringify([
        { id: "A", name: "A", color: "#6366F1", income: 0 },
        { id: "B", name: "B", color: "#10B981", income: 0 },
      ]);
      const defaultLines = JSON.stringify([]);
      await runQuery(
        `INSERT INTO couple_split_configs (id, members_json, lines_json, custom_prorata_a, ignored_recurring_ids)
         VALUES (1, ?, ?, 50, '[]')`,
        [defaultMembers, defaultLines]
      );
      console.log('�o" Configuration couple_split_configs initialisée.');
    }

    // Migrations incrémentales V1.1.0
    const migrateAdvancedRecurring = require("./migrate_2025_advanced_recurring");
    await migrateAdvancedRecurring();

    console.log("✅ Migrations terminées avec succès.");
  } catch (err) {
    console.error(
      "❌ ERREUR FATALE lors de l'initialisation de la base de données:",
      err.message
    );
    // Dans un cas réel, on pourrait vouloir arrêter l'application ici
    process.exit(1);
  }
  // Note: La connexion à la base de données n'est plus fermée ici
  // pour qu'elle reste disponible pour le reste de l'application.
};

module.exports = initializeDatabase;

