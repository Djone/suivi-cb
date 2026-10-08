const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { nextCandidate, candidateInventory } = require('../../backend/services/candidate-inventory');

test('next candidate recognizes legacy rc2 and dotted rc.3, ignoring other stable versions', () => {
  assert.equal(nextCandidate('2.2.0', ['2.2.0-rc2', '2.2.0-rc.3', '12.2.0-rc99', '2.3.0-rc.9']).next, '2.2.0-rc.4');
  assert.equal(nextCandidate('2.2.0', []).next, '2.2.0-rc.1');
  assert.throws(() => nextCandidate('../../bad', []));
});

test('inventory combines reserved package directories, legacy archives and Docker tags', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'suivi-cb-inventory-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, '.cache', 'releases', '2.2.0-rc.4'), { recursive: true });
  fs.writeFileSync(path.join(root, 'suivi-cb-preprod-2.2.0-rc2.tar'), '');
  const result = await candidateInventory(root, '2.2.0', async () => ({ stdout: 'suivi-cb-preprod-backend:2.2.0-rc.6\nunrelated:2.2.0-rc99' }));
  assert.equal(result.next, '2.2.0-rc.7');
  assert.equal(result.dockerAvailable, true);
});

test('Docker failure is explicit and reserved failed builds still consume numbers', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'suivi-cb-inventory-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, '.cache', 'releases', '2.2.0-rc.8'), { recursive: true });
  const result = await candidateInventory(root, '2.2.0', async () => { throw new Error('Docker stopped'); });
  assert.equal(result.next, '2.2.0-rc.9');
  assert.equal(result.dockerAvailable, false);
});
