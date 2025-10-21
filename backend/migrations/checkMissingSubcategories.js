const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.db');

const db = new sqlite3.Database(dbPath);

console.log('Catégories disponibles:\n');
db.all(`
  SELECT c.id, c.label as category_label, c.financial_flow_id
  FROM categories c
  WHERE c.is_active = 1
  ORDER BY c.label
`, (err, categories) => {
  if (err) {
    console.error(err);
    return;
  }

  categories.forEach(cat => {
    console.log(`[${cat.id}] ${cat.category_label} (flux: ${cat.financial_flow_id})`);
  });

  console.log('\n\nSous-catégories manquantes à créer:');
  console.log('- Abondement');
  console.log('- Intérêts');
  console.log('- Crédit d\'impôts');
  console.log('- Cotisation Compte bancaires');
  console.log('- Pelouse/jardin');
  console.log('- Avance');
  console.log('- Compte joint');

  db.close();
});
