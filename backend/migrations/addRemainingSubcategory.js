const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.db');

function addSubcategory() {
  const db = new sqlite3.Database(dbPath);

  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO subcategories (label, category_id) VALUES (?, ?)',
      ['Habitation - Entretien', 53],  // category 53 = Habitation
      function(err) {
        if (err) {
          console.error('Erreur:', err.message);
          reject(err);
        } else {
          console.log('✓ Sous-catégorie "Habitation - Entretien" ajoutée (ID:', this.lastID + ')');
          db.close();
          resolve(this.lastID);
        }
      }
    );
  });
}

addSubcategory()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
