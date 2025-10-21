const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.db');
const db = new sqlite3.Database(dbPath);

console.log('Vérification de l\'import des transactions:\n');

db.get('SELECT COUNT(*) as total FROM transactions', (err, row) => {
  if (err) {
    console.error('Erreur:', err);
  } else {
    console.log(`✓ Nombre total de transactions dans la base: ${row.total}`);
  }

  db.get('SELECT MIN(date) as min_date, MAX(date) as max_date FROM transactions', (err, row) => {
    if (err) {
      console.error('Erreur:', err);
    } else {
      console.log(`✓ Plage de dates: ${row.min_date} à ${row.max_date}`);
    }

    db.get('SELECT SUM(amount) as total_amount FROM transactions WHERE financial_flow_id = 1', (err, row) => {
      if (err) {
        console.error('Erreur:', err);
      } else {
        console.log(`✓ Total des revenus: ${row.total_amount ? row.total_amount.toFixed(2) : 0} EUR`);
      }

      db.get('SELECT SUM(amount) as total_amount FROM transactions WHERE financial_flow_id = 2', (err, row) => {
        if (err) {
          console.error('Erreur:', err);
        } else {
          console.log(`✓ Total des dépenses: ${row.total_amount ? Math.abs(row.total_amount).toFixed(2) : 0} EUR`);
        }
        db.close();
      });
    });
  });
});
