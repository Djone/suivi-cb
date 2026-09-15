jest.mock('../../config/db', () => new (require('sqlite3').verbose().Database)(':memory:'));
const db = require('../../config/db');
const migrate = require('../../migrations/salary-tracker');
const express = require('express');
let server, url;
beforeAll(async () => {
  await migrate(db);
  const app = express();
  app.use(express.json());
  app.use('/annual', require('../../routes/salary-annual.routes'));
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  url = `http://127.0.0.1:${server.address().port}/annual`;
});
afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await new Promise(resolve => db.close(resolve));
});
test('persists unknown values and refunds, updates without creating duplicates', async () => {
  const save = data => fetch(`${url}/2018`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  expect((await save({ rfr: 28666, ir: -515 })).status).toBe(200);
  await migrate(db);
  expect(await (await fetch(url)).json()).toEqual([{ year: 2018, rfr: 28666, ir: -515 }]);
  expect((await save({ rfr: null, ir: 0 })).status).toBe(200);
  expect(await (await fetch(url)).json()).toEqual([{ year: 2018, rfr: null, ir: 0 }]);
});
test('rejects invalid year and negative RFR', async () => {
  for (const [year, data] of [['bad', { rfr: 0, ir: 0 }], ['2026', { rfr: -1, ir: 0 }]]) {
    expect((await fetch(`${url}/${year}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })).status).toBe(400);
  }
});
