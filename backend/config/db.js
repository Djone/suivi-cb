const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Le chemin de la base de données est déterminé par la variable d'environnement DB_PATH.
// Si elle n'est pas définie (en dev), on utilise un chemin par défaut vers le dossier /data à la racine du projet.
const isProduction = process.env.NODE_ENV === 'production';
// En production, utilise `database.db`. En développement, utilise `database.dev.db`.
const dbFilename = isProduction ? 'database.db' : 'database.dev.db';
const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data', dbFilename);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error(`❌ Erreur lors de la connexion à SQLite sur le chemin : ${dbPath}`, err.message);
  } else {
    console.log(`🔗 Connecté à la base de données SQLite : ${dbPath}`);
  }
});

module.exports = db;