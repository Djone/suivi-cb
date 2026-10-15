const db = require('../../config/db');

afterAll(done => { db.close(done); });

test('Jest uses an isolated in-memory database even when launched from development', () => {
  expect(process.env.NODE_ENV).toBe('test');
  expect(process.env.DB_PATH).toBe(':memory:');
  expect(db.filename).toBe(':memory:');
});
