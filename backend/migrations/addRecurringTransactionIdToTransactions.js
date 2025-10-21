const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.db');

/**
 * Migration: Ajouter le champ recurring_transaction_id à la table transactions
 *
 * Ce champ permet de lier une transaction réelle à une échéance récurrente prévisionnelle
 * Cela permet de:
 * - Suivre les écarts entre prévisionnel et réel
 * - Améliorer le calcul du solde prévisionnel
 * - Savoir quelles échéances ont déjà été réalisées
 */

function addRecurringTransactionIdColumn() {
  const db = new sqlite3.Database(dbPath);

  return new Promise((resolve, reject) => {
    // Ajouter la colonne recurring_transaction_id (nullable)
    db.run(
      `ALTER TABLE transactions ADD COLUMN recurring_transaction_id INTEGER NULL
       REFERENCES recurring_transactions(id) ON DELETE SET NULL`,
      (err) => {
        if (err) {
          // Si la colonne existe déjà, ce n'est pas grave
          if (err.message.includes('duplicate column name')) {
            console.log('⚠ La colonne recurring_transaction_id existe déjà');
            db.close();
            resolve();
          } else {
            console.error('Erreur lors de l\'ajout de la colonne recurring_transaction_id:', err.message);
            db.close();
            reject(err);
          }
        } else {
          console.log('✓ Colonne recurring_transaction_id ajoutée à transactions');

          // Créer un index pour améliorer les performances
          db.run(
            `CREATE INDEX IF NOT EXISTS idx_transactions_recurring_id
             ON transactions(recurring_transaction_id)`,
            (err) => {
              if (err) {
                console.error('Erreur lors de la création de l\'index:', err.message);
              } else {
                console.log('✓ Index créé sur recurring_transaction_id');
              }

              // Vérifier la structure de la table
              db.all('PRAGMA table_info(transactions)', (err, rows) => {
                if (err) {
                  console.error('Erreur lors de la vérification:', err);
                } else {
                  console.log('\n✓ Structure mise à jour de la table transactions:');
                  rows.forEach(col => {
                    console.log(`  - ${col.name}: ${col.type}${col.dflt_value ? ` (défaut: ${col.dflt_value})` : ''}${col.notnull ? ' NOT NULL' : ''}`);
                  });
                }
                db.close();
                resolve();
              });
            }
          );
        }
      }
    );
  });
}

if (require.main === module) {
  console.log('Ajout du champ recurring_transaction_id à la table transactions...\n');
  addRecurringTransactionIdColumn()
    .then(() => {
      console.log('\n✓ Migration terminée avec succès!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nErreur lors de la migration:', error);
      process.exit(1);
    });
}

module.exports = addRecurringTransactionIdColumn;
