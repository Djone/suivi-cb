const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.db');

const missingSubcategories = [
  { label: 'Abondement', categoryId: 8 },  // Salaires (revenus)
  { label: 'Intérêts', categoryId: 11 },   // Autres revenus
  { label: 'Crédit d\'impôts', categoryId: 10 }, // Impôts (revenus)
  { label: 'Cotisation Compte bancaires', categoryId: 58 }, // Fournisseurs (dépenses)
  { label: 'Pelouse/jardin', categoryId: 53 }, // Habitation (dépenses)
  { label: 'Avance', categoryId: 60 },      // Autres (dépenses)
  { label: 'Compte joint', categoryId: 60 } // Autres (dépenses)
];

function addMissingSubcategories() {
  const db = new sqlite3.Database(dbPath);

  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO subcategories (label, category_id)
      VALUES (?, ?)
    `);

    let added = 0;

    missingSubcategories.forEach(sub => {
      stmt.run(sub.label, sub.categoryId, (err) => {
        if (err) {
          console.error(`Erreur lors de l'ajout de "${sub.label}":`, err.message);
        } else {
          console.log(`✓ Sous-catégorie ajoutée: ${sub.label} (catégorie: ${sub.categoryId})`);
          added++;
        }
      });
    });

    stmt.finalize((err) => {
      if (err) {
        reject(err);
      } else {
        console.log(`\n✓ ${added} sous-catégories ajoutées avec succès`);
        db.close();
        resolve(added);
      }
    });
  });
}

if (require.main === module) {
  console.log('Ajout des sous-catégories manquantes...\n');
  addMissingSubcategories()
    .then(() => {
      console.log('\n✓ Terminé!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\nErreur:', error);
      process.exit(1);
    });
}

module.exports = addMissingSubcategories;
