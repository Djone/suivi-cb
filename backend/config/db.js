const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('Erreur lors de la connexion à SQLite:', err.message);
  } else {
    console.log('Connecté à la base de données SQLite.');
  }
});

module.exports = db;