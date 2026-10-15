const { createHash } = require('node:crypto');
const fs = require('node:fs');

const run = (db, sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (error) { if (error) reject(error); else resolve(this); });
});
const all = (db, sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows));
});

function checksumFiles(files) {
  const hash = createHash('sha256');
  for (const file of files) hash.update(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')).update('\0');
  return hash.digest('hex');
}

async function addColumn(db, table, definition) {
  if (!/^[a-z_]+$/.test(table) || !/^[a-z_]+\s/i.test(definition)) throw new Error('Invalid migration identifier');
  const name = definition.split(/\s+/)[0];
  const columns = await all(db, `PRAGMA table_info("${table}")`);
  if (!columns.length) throw new Error(`Missing migration table: ${table}`);
  if (!columns.some(column => column.name === name)) await run(db, `ALTER TABLE "${table}" ADD COLUMN ${definition}`);
}

async function runMigrations(db, migrations) {
  await run(db, 'PRAGMA busy_timeout = 10000');
  await run(db, 'PRAGMA foreign_keys = ON');
  await run(db, 'BEGIN IMMEDIATE');
  try {
    await run(db, `CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL
    )`);
    const applied = await all(db, 'SELECT id, checksum FROM schema_migrations ORDER BY id');
    const ids = migrations.map(m => m.id);
    if (new Set(ids).size !== ids.length || ids.some((id, i) => i > 0 && id <= ids[i - 1])) throw new Error('Migration IDs must be unique and ordered');
    for (const row of applied) {
      const migration = migrations.find(m => m.id === row.id);
      if (!migration) throw new Error(`Unknown applied migration: ${row.id}; application rollback requires compatibility review`);
      if (migration.checksum !== row.checksum) throw new Error(`Migration checksum changed: ${row.id}`);
    }
    if (applied.some((row, index) => row.id !== ids[index])) throw new Error('Applied migration history is not a contiguous prefix');
    for (const migration of migrations) {
      if (applied.some(row => row.id === migration.id)) continue;
      await migration.up(db);
      const violations = await all(db, 'PRAGMA foreign_key_check');
      if (violations.length) throw new Error('Foreign key violations after migration');
      await run(db, 'INSERT INTO schema_migrations(id, checksum, applied_at) VALUES (?, ?, ?)',
        [migration.id, migration.checksum, new Date().toISOString()]);
    }
    await run(db, 'COMMIT');
  } catch (error) {
    try { await run(db, 'ROLLBACK'); } catch { /* preserve the original failure */ }
    throw error;
  }
}

module.exports = { runMigrations, checksumFiles, addColumn, run, all };
