const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let dbInstance = null;

const getDbConnection = () => {
  if (dbInstance) {
    return dbInstance;
  }

  const nodeEnv = process.env.NODE_ENV;
  const isProduction = nodeEnv === 'production';
  const isTest = nodeEnv === 'test';

  const log = (...args) => {
    if (!isTest) console.log(...args);
  };

  log('[DB_DEBUG] Initializing DB connection (first call).');
  log(`[DB_DEBUG]   process.env.NODE_ENV: "${nodeEnv}"`);
  log(`[DB_DEBUG]   isProduction flag: ${isProduction}`);

  let dbPath;
  if (process.env.DB_PATH) {
    dbPath = process.env.DB_PATH;
    log(`[DB_DEBUG]   DB_PATH explicitly set in environment: "${dbPath}" (priority)`);
  } else {
    const dbFilename = isProduction ? 'database.db' : 'database.dev.db';
    dbPath = path.join(__dirname, '../../data', dbFilename);
    log('[DB_DEBUG]   DB_PATH not set, determining from NODE_ENV.');
    log(`[DB_DEBUG]     Chosen filename: "${dbFilename}"`);
    log(`[DB_DEBUG]     Calculated path: "${dbPath}"`);
  }

  log(`[DB_DEBUG] Attempting to connect to: "${dbPath}"`);

  dbInstance = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error(`Database connection error on path: ${dbPath}`, err.message);
      process.exit(1);
    } else {
      log(`Connected to SQLite database: "${dbInstance.filename}"`);
    }
  });

  try {
    dbInstance.run('PRAGMA foreign_keys = ON');
  } catch (e) {
    if (!isTest) {
      console.warn('[DB_DEBUG] Failed to enable foreign_keys PRAGMA:', e?.message || e);
    }
  }

  return dbInstance;
};

module.exports = getDbConnection();
