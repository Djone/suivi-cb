const db = require('../config/db');

// Fonction pour créer les tables
function initializeDatabase() {
    const createTransactionsTable = `
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date DATE NOT NULL,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      sub_category_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      financial_flow_id INTEGER NOT NULL,
      recurring_transaction_id INTEGER NULL REFERENCES recurring_transactions(id) ON DELETE SET NULL
    );`;

    const createCategoriesTable = `
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL, 
      financial_flow_id INTEGER,
      is_active INTEGER DEFAULT 1
    );`;

    const createSubCategoriesTable = `
    CREATE TABLE IF NOT EXISTS subcategories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL,
        label TEXT NOT NULL
    );`;

    /**
    * Migration pour créer la table recurring_transactions
    * Cette table stocke les transactions récurrentes mensuelles pour le prévisionnel
    */
    const createRecurringTransactionsTable = `
    CREATE TABLE IF NOT EXISTS recurring_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      amount REAL NOT NULL,
      day_of_month INTEGER NOT NULL,
      sub_category_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      financial_flow_id INTEGER NOT NULL,
      frequency TEXT NOT NULL DEFAULT 'monthly',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`;

    const createAccountsTable = `
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#1976d2',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`;

    db.run(createTransactionsTable, (err) => {
        if (err) {
            console.error('X Erreur lors de la création de la table "transactions":', err.message);
        } 
        console.log('✓ Table "transactions" vérifiée/créée avec succès.');
        resolve();
    });

    db.run(createCategoriesTable, (err) => {
        if (err) {
            console.error('X Erreur lors de la création de la table "categories":', err.message);
        } 
        console.log('✓ Table "categories" vérifiée/créée avec succès.');
        resolve();
    });

    db.run(createSubCategoriesTable, (err) => {
        if (err) {
            console.error('X Erreur lors de la création de la table "sub categories":', err.message);
        } 
        console.log('✓ Table "sub categories" vérifiée/créée avec succès.');
        resolve();
    });

    db.run(createRecurringTransactionsTable, (err) => {
        if (err) {
            console.error('X Erreur lors de la création de la table "recurring_transactions":', err.message);
            return reject(err);
        }
        console.log('✓ Table "recurring_transactions" vérifiée/créée avec succès.');
        resolve();
    });

    db.run(createAccountsTable, (err) => {
        if (err) {
        console.error('Erreur lors de la création de la table accounts:', err.message);
        db.close();
      } else {
        console.log('✓ Table accounts créée avec succès.');

        // Insérer les comptes par défaut s'ils n'existent pas
        db.get('SELECT COUNT(*) as count FROM accounts', (err, row) => {
          if (err) {
            console.error('Erreur lors de la vérification des comptes:', err.message);
            db.close();
          } else if (row.count === 0) {
            // Insérer le compte courant (ID = 1)
            db.run(
              `INSERT INTO accounts (id, name, description, color, is_active)
               VALUES (1, 'Compte courant', 'Compte bancaire principal', '#1976d2', 1)`,
              (err) => {
                if (err) {
                  console.error('Erreur lors de l\'insertion du compte courant:', err.message);
                } else {
                  console.log('✓ Compte courant créé avec succès.');
                }
              }
            );

            // Insérer le compte joint (ID = 2)
            db.run(
              `INSERT INTO accounts (id, name, description, color, is_active)
               VALUES (2, 'Compte joint', 'Compte bancaire joint', '#4caf50', 1)`,
              (err) => {
                if (err) {
                  console.error('Erreur lors de l\'insertion du compte joint:', err.message);
                } else {
                  console.log('✓ Compte joint créé avec succès.');
                }

                // Fermer la base après la dernière insertion
                db.close((err) => {
                  if (err) {
                    console.error('Erreur lors de la fermeture de la base de données:', err.message);
                  } else {
                    console.log('✓ Migration terminée.');
                  }
                });
              }
            );
          } else {
            console.log('Des comptes existent déjà, aucune insertion nécessaire.');
            db.close((err) => {
              if (err) {
                console.error('Erreur lors de la fermeture de la base de données:', err.message);
              } else {
                console.log('✓ Migration terminée.');
              }
            });
          }
        });
      }
    });
}

module.exports = initializeDatabase;