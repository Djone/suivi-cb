const db = require('../config/db');

// Fonction utilitaire pour "promisifier" db.get
const getQuery = (query, params = []) => new Promise((resolve, reject) => {
  db.get(query, params, (err, row) => (err ? reject(err) : resolve(row)));
});

const verifyImport = async () => {
  try {
    console.log('Vérification de l\'import des transactions:\n');

    let row = await getQuery('SELECT COUNT(*) as total FROM transactions');
    console.log(`✓ Nombre total de transactions dans la base: ${row.total}`);

    row = await getQuery('SELECT MIN(date) as min_date, MAX(date) as max_date FROM transactions');
    console.log(`✓ Plage de dates: ${row.min_date} à ${row.max_date}`);

    row = await getQuery('SELECT SUM(amount) as total_amount FROM transactions WHERE financial_flow_id = 1');
    console.log(`✓ Total des revenus: ${row.total_amount ? row.total_amount.toFixed(2) : 0} EUR`);

    row = await getQuery('SELECT SUM(amount) as total_amount FROM transactions WHERE financial_flow_id = 2');
    console.log(`✓ Total des dépenses: ${row.total_amount ? Math.abs(row.total_amount).toFixed(2) : 0} EUR`);

  } catch (err) {
    console.error('❌ Erreur lors de la vérification:', err.message);
  }
};

verifyImport();
