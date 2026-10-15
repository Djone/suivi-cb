const db = require('../config/db');
const path = require('node:path');
const { runMigrations, checksumFiles } = require('./runner');
const initializeLegacy = require('./legacy-baseline');

// Applied migration files are immutable. Add subsequent migrations here.
module.exports = () => runMigrations(db, [{
  id: '20261015_001_legacy_schema',
  checksum: checksumFiles(['legacy-baseline.js', 'migrate_2025_advanced_recurring.js', 'salary-tracker.js'].map(file => path.join(__dirname, file))),
  up: initializeLegacy,
}]);
