const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const sqlite3 = require('sqlite3');
const { runMigrations, run, all, addColumn } = require('../../migrations/runner');
const database = () => new sqlite3.Database(':memory:');
const close = db => new Promise((resolve, reject) => db.close(e => e ? reject(e) : resolve()));

test('a migration is recorded once and a subsequent restart preserves new data', async () => {
  const db = database();
  try {
    let calls = 0;
    const migrations = [{ id: '001', checksum: 'abc', up: async () => {
      calls++;
      await run(db, 'CREATE TABLE entries(id INTEGER PRIMARY KEY, value TEXT)');
    } }];
    await runMigrations(db, migrations);
    await run(db, "INSERT INTO entries VALUES (1, 'new-write')");
    await runMigrations(db, migrations);
    assert.equal(calls, 1);
    assert.equal((await all(db, 'SELECT value FROM entries'))[0].value, 'new-write');
    assert.equal((await all(db, 'SELECT * FROM schema_migrations')).length, 1);
  } finally { await close(db); }
});

test('failed schema and data changes roll back and can be retried', async () => {
  const db = database();
  try {
    await run(db, 'CREATE TABLE existing(id INTEGER)');
    await run(db, 'INSERT INTO existing VALUES (7)');
    await assert.rejects(runMigrations(db, [{ id: '001', checksum: 'abc', up: async () => {
      await run(db, 'CREATE TABLE partial(id INTEGER)');
      await run(db, 'DELETE FROM existing');
      await run(db, 'INSERT INTO missing VALUES (1)');
    } }]), /missing/);
    assert.equal((await all(db, 'SELECT id FROM existing'))[0].id, 7);
    assert.equal((await all(db, "SELECT name FROM sqlite_master WHERE name IN ('partial','schema_migrations')")).length, 0);
    await runMigrations(db, [{ id: '001', checksum: 'abc', up: async () => {} }]);
  } finally { await close(db); }
});

test('changed checksums and unknown applied migrations block startup', async () => {
  const db = database();
  try {
    await runMigrations(db, [{ id: '001', checksum: 'abc', up: async () => {} }]);
    await assert.rejects(runMigrations(db, [{ id: '001', checksum: 'changed', up: async () => {} }]), /checksum/);
    await assert.rejects(runMigrations(db, []), /Unknown applied migration/);
  } finally { await close(db); }
});

test('existing columns are skipped explicitly but other ALTER failures propagate', async () => {
  const db = database();
  try {
    await run(db, 'CREATE TABLE entries(id INTEGER)');
    await addColumn(db, 'entries', 'id INTEGER');
    await addColumn(db, 'entries', 'label TEXT');
    await assert.rejects(addColumn(db, 'missing', 'label TEXT'), /Missing/);
    await assert.rejects(addColumn(db, 'entries', 'bad INVALID SQL SYNTAX NOT NULL DEFAULT'), /SQLITE_ERROR/);
  } finally { await close(db); }
});

test('a gap in applied history blocks startup instead of applying migrations out of order', async () => {
  const db = database();
  try {
    const migrations = ['001', '002'].map(id => ({ id, checksum: id, up: async () => {} }));
    await runMigrations(db, migrations);
    await run(db, "DELETE FROM schema_migrations WHERE id = '001'");
    await assert.rejects(runMigrations(db, migrations), /contiguous prefix/);
  } finally { await close(db); }
});

test('deferred foreign-key violations roll back the entire migration', async () => {
  const db = database();
  try {
    await assert.rejects(runMigrations(db, [{ id: '001', checksum: 'abc', up: async () => {
      await run(db, 'CREATE TABLE parent(id INTEGER PRIMARY KEY)');
      await run(db, 'CREATE TABLE child(parent_id INTEGER REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)');
      await run(db, 'INSERT INTO child VALUES (999)');
    } }]), /Foreign key violations/);
    assert.equal((await all(db, "SELECT name FROM sqlite_master WHERE name = 'child'")).length, 0);
  } finally { await close(db); }
});

test('the actual legacy initializer works twice on a synthetic database', () => {
  const output = execFileSync(process.execPath, ['-e', `
    const init = require('./migrations/initializeDatabase');
    const db = require('./config/db');
    (async () => { await init(); await init(); db.get('SELECT count(*) n FROM schema_migrations', (e, r) => {
      if (e || r.n !== 1) process.exitCode = 1; else console.log('BASELINE_OK'); db.close();
    }); })().catch(() => { process.exitCode = 1; db.close(); });
  `], { cwd: path.resolve(__dirname, '../..'), env: { ...process.env, NODE_ENV: 'test', DB_PATH: ':memory:' }, encoding: 'utf8' });
  assert.match(output, /BASELINE_OK/);
});
