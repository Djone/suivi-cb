const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let dbInstance = null;

const getDbConnection = () => {
  if (dbInstance) {
    return dbInstance;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const dbFilename = isProduction ? 'database.db' : 'database.dev.db';
  const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data', dbFilename);

  dbInstance = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error(`❌ Erreur lors de la connexion à SQLite sur le chemin : ${dbPath}`, err.message);
      process.exit(1); // Arrêter si la connexion échoue
    } else {
      console.log(`🔗 Connecté à la base de données SQLite : ${dbPath}`);
    }
  });

  return dbInstance;
};

module.exports = getDbConnection();