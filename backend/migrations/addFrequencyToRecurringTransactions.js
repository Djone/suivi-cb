const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.db');

/**
 * Migration: Ajouter le champ frequency à la table recurring_transactions
 *
 * Fréquences possibles:
 * - 'monthly' (mensuelle) - par défaut
 * - 'bimonthly' (bimensuelle) - tous les 2 mois
 * - 'quarterly' (trimestrielle) - tous les 3 mois
 * - 'yearly' (annuelle) - une fois par an
 */

function addFrequencyColumn() {
  const db = new sqlite3.Database(dbPath);

  return new Promise((resolve, reject) => {
    // Ajouter la colonne frequency avec 'monthly' comme valeur par défaut
    db.run(
      `ALTER TABLE recurring_transactions ADD COLUMN frequency TEXT NOT NULL DEFAULT 'monthly'`,
      (err) => {
        if (err) {
          // Si la colonne existe déjà, ce n'est pas grave
          if (err.message.includes('duplicate column name')) {
            console.log('⚠ La colonne frequency existe déjà');
            db.close();
            resolve();
          } else {
            console.error('Erreur lors de l\'ajout de la colonne frequency:', err.message);
            db.close();
            reject(err);
          }
        } else {
          console.log('✓ Colonne frequency ajoutée à recurring_transactions');

          // Vérifier la structure de la table
          db.all('PRAGMA table_info(recurring_transactions)', (err, rows) => {
            if (err) {
              console.error('Erreur lors de la vérification:', err);
            } else {
              console.log('\n✓ Structure mise à jour de la table recurring_transactions:');
              rows.forEach(col => {
                console.log(`  - ${col.name}: ${col.type}${col.dflt_value ? ` (défaut: ${col.dflt_value})` : ''}`);
              });
            }
            db.close();
            resolve();
          });
        }
      }
    );
  });
}

if (require.main === module) {
  console.log('Ajout du champ frequency à la table recurring_transactions...\n');
  addFrequencyColumn()
    .then(() => {
      console.log('\n✓ Migration terminée avec succès!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nErreur lors de la migration:', error);
      process.exit(1);
    });
}

module.exports = addFrequencyColumn;
