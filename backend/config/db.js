const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let dbInstance = null;

const getDbConnection = () => {
  if (dbInstance) {
    return dbInstance;
  }

  console.log(`[DB_DEBUG] Initializing DB connection.`);
  const nodeEnv = process.env.NODE_ENV;
  const isProduction = nodeEnv === 'production';
  console.log(`[DB_DEBUG]   process.env.NODE_ENV: "${nodeEnv}"`);
  console.log(`[DB_DEBUG]   isProduction flag: ${isProduction}`);

  let dbPath;
  if (process.env.DB_PATH) {
    dbPath = process.env.DB_PATH;
    console.log(`[DB_DEBUG]   DB_PATH explicitly set in environment: "${dbPath}"`);
  } else {
    const dbFilename = isProduction ? 'database.db' : 'database.dev.db';
    dbPath = path.join(__dirname, '../../data', dbFilename);
    console.log(`[DB_DEBUG]   DB_PATH not set, determining from NODE_ENV.`);
    console.log(`[DB_DEBUG]     Chosen filename: "${dbFilename}"`);
    console.log(`[DB_DEBUG]     Calculated path: "${dbPath}"`);
  }

  dbInstance = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error(`❌ Erreur lors de la connexion à SQLite sur le chemin : ${dbPath}`, err.message);
      process.exit(1); // Arrêter si la connexion échoue
    } else {
      console.log(`🔗 Successfully connected to SQLite database: "${dbInstance.filename}"`);
    }
  });

  return dbInstance;
};

module.exports = getDbConnection();