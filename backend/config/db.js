const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Le chemin de la base de données est déterminé par la variable d'environnement DB_PATH.
// Si elle n'est pas définie (en dev), on utilise un chemin par défaut vers le dossier /data à la racine du projet.
const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/database.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error(`❌ Erreur lors de la connexion à SQLite sur le chemin : ${dbPath}`, err.message);
  } else {
    console.log(`🔗 Connecté à la base de données SQLite : ${dbPath}`);
  }
});

module.exports = db;