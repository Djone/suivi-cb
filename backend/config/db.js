const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let dbInstance = null;

const getDbConnection = () => {
  if (dbInstance) {
    return dbInstance;
  }

  const nodeEnv = process.env.NODE_ENV;
  const isProduction = nodeEnv === 'production';
  
  // Log the environment variable for debugging
  console.log(`[DB_DEBUG] NODE_ENV: ${nodeEnv}, isProduction: ${isProduction}`);

  let dbPath;
  if (process.env.DB_PATH) {
    dbPath = process.env.DB_PATH;
    console.log(`[DB_DEBUG] Using DB_PATH from environment: ${dbPath}`);
  } else {
    const dbFilename = isProduction ? 'database.db' : 'database.dev.db';
    dbPath = path.join(__dirname, '../../data', dbFilename);
    console.log(`[DB_DEBUG] DB_PATH not set, determining from NODE_ENV. Filename: ${dbFilename}, Path: ${dbPath}`);
  }

  dbInstance = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error(`❌ Erreur lors de la connexion à SQLite sur le chemin : ${dbPath}`, err.message);
      process.exit(1); // Arrêter si la connexion échoue
    } else {
      console.log(`🔗 Connecté à la base de données SQLite : ${dbPath} (Instance: ${dbInstance.filename})`);
    }
  });

  return dbInstance;
};

module.exports = getDbConnection();