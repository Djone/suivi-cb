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
      financial_flow_id INTEGER NOT NULL
    );`;

    const createCategoriesTable = `
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL, 
      financial_flow_id INTEGER
    );`;

    const createSubCategoriesTable = `
    CREATE TABLE IF NOT EXISTS subcategories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL,
        label TEXT NOT NULL
    );`;

    db.run(createTransactionsTable, (err) => {
        if (err) {
            console.error('Erreur lors de la création de la table "transactions":', err.message);
        } else {
            console.log('Table "transactions" vérifiée/créée avec succès.');
        }
    });

    db.run(createCategoriesTable, (err) => {
        if (err) {
            console.error('Erreur lors de la création de la table "categories":', err.message);
        } else {
            console.log('Table "categories" vérifiée/créée avec succès.');
        }
    });

    db.run(createSubCategoriesTable, (err) => {
        if (err) {
            console.error('Erreur lors de la création de la table "sub categories":', err.message);
        } else {
            console.log('Table "sub categories" vérifiée/créée avec succès.');
        }
    });
}

module.exports = initializeDatabase;