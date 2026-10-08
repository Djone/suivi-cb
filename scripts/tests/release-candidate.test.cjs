const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { config, buildPackage, readPackage, transferPackage, approvePackage } = require('../release-candidate');
const ids = ['sha256:' + 'a'.repeat(64), 'sha256:' + 'b'.repeat(64)];

function fixture(t, fail = '') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'suivi-cb-candidate-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const c = config({ candidate: '2.2.0-rc.3' }, root);
  const calls = [];
  const execute = (p, a) => {
    calls.push([p, a]);
    if (fail && a.join(' ').includes(fail)) throw new Error('simulated failure');
    if (p === 'git') return a[0] === 'status' ? '' : 'c'.repeat(40);
    if (p === 'docker' && a[0] === 'image' && a[1] === 'ls') return '';
    if (p === 'docker' && a[0] === 'image' && a[1] === 'inspect') return JSON.stringify([{ Id: ids[a[2].includes('backend') ? 0 : 1], Os: 'linux', Architecture: 'amd64' }]);
    if (p === 'docker' && a[0] === 'save') fs.writeFileSync(a[2], 'test archive');
    if (a[0]?.endsWith('audit-image-archive.mjs')) fs.writeFileSync(a[2], JSON.stringify({ images: ids.map((id, i) => ({ configDigest: id, sensitivePaths: [], sourceDifferences: [], nginx: i ? { matchesWorkspace: true, silentSsoException: true } : {} })) }));
    return '';
  };
  return { c, calls, execute };
}

test('reject unsafe destinations, options and candidate versions', () => {
  for (const options of [{ candidate: '../rc' }, { candidate: '2.2.0-rc.3', host: '-oProxyCommand=bad' },
    { candidate: '2.2.0-rc.3', 'remote-root': '/volume1/../prod' }, { candidate: '2.2.0-rc.3', port: '0' }]) {
    assert.throws(() => config(options));
  }
});

test('build creates checksummed package pinned to exact IDs, without publishing Git or deploying', async t => {
  const { c, calls, execute } = fixture(t);
  await buildPackage(c, execute);
  const m = await readPackage(c);
  assert.equal(m.images.backend.id, ids[0]);
  assert.match(fs.readFileSync(path.join(c.dir, 'docker-compose.yml'), 'utf8'), /image: sha256:a{64}/);
  assert.equal(calls.filter(([p, a]) => p === 'docker' && a[0] === 'build').length, 2);
  assert.ok(!calls.some(([p, a]) => p === 'ssh' || (p === 'git' && a[0] === 'push')));
  await assert.rejects(buildPackage(c, execute), /EEXIST/);
});

test('failed dev tests prevent building images', async t => {
  const { c, calls, execute } = fixture(t, 'backend test');
  await assert.rejects(buildPackage(c, execute), /simulated failure/);
  assert.ok(!calls.some(([p, a]) => p === 'docker' && a[0] === 'build'));
  assert.ok(!fs.existsSync(path.join(c.dir, 'manifest.json')));
});

test('dirty repository prevents reserving a candidate', async t => {
  const { c, execute } = fixture(t);
  await assert.rejects(buildPackage(c, (p, a, o) => p === 'git' && a[0] === 'status' ? ' M nginx.conf' : execute(p, a, o)), /dépôt doit être propre/);
  assert.ok(!fs.existsSync(c.dir));
});

test('sensitive archive contents prevent completing the package', async t => {
  const { c, execute } = fixture(t);
  await assert.rejects(buildPackage(c, (p, a, o) => {
    const result = execute(p, a, o);
    if (a[0]?.endsWith('audit-image-archive.mjs')) {
      const report = JSON.parse(fs.readFileSync(a[2], 'utf8'));
      report.images[0].sensitivePaths.push('app/database.db');
      fs.writeFileSync(a[2], JSON.stringify(report));
    }
    return result;
  }), /Inspection archive refusée/);
  assert.ok(!fs.existsSync(path.join(c.dir, 'SHA256SUMS')));
});

test('a different image architecture prevents exporting the candidate', async t => {
  const { c, calls, execute } = fixture(t);
  await assert.rejects(buildPackage(c, (p, a, o) => {
    const result = execute(p, a, o);
    if (p === 'docker' && a[0] === 'image' && a[1] === 'inspect') {
      return JSON.stringify([{ Id: ids[0], Os: 'linux', Architecture: 'arm64' }]);
    }
    return result;
  }), /plateforme image invalide/);
  assert.ok(!calls.some(([p, a]) => p === 'docker' && a[0] === 'save'));
});

test('tampered archive prevents transfer before any SSH connection', async t => {
  const { c, calls, execute } = fixture(t);
  await buildPackage(c, execute);
  fs.appendFileSync(path.join(c.dir, 'images.tar'), 'tampered');
  await assert.rejects(transferPackage(c, execute), /Package modifié/);
  assert.ok(!calls.some(([p]) => p === 'ssh'));
});

test('transfer uses legacy SCP and verifies hashes; never starts NAS containers', async t => {
  const { c, calls, execute } = fixture(t);
  await buildPackage(c, execute);
  await transferPackage(c, execute);
  assert.ok(calls.some(([p, a]) => p === 'scp' && a.includes('-O')));
  assert.ok(calls.some(([p, a]) => p === 'ssh' && a.at(-1).includes('sha256sum -c')));
  assert.ok(!calls.some(([p, a]) => p === 'ssh' && /\bdocker\s|\bdocker-compose\s/.test(a.at(-1))));
});

test('failed transfer releases its lock and cannot mark upload complete', async t => {
  const { c, execute } = fixture(t);
  await buildPackage(c, execute);
  const calls = [];
  await assert.rejects(transferPackage(c, (p, a) => { calls.push([p, a]); if (p === 'scp') throw new Error('transfer failed'); return ''; }), /transfer failed/);
  assert.ok(calls.some(([p, a]) => p === 'ssh' && a.at(-1).startsWith('rmdir ')));
  assert.ok(!calls.some(([p, a]) => p === 'ssh' && a.at(-1).includes('sha256sum -c')));
});

test('approval binds exact images and evidence; mismatch and overwrite refused', async t => {
  const { c, execute } = fixture(t);
  await buildPackage(c, execute);
  fs.writeFileSync(path.join(c.root, 'evidence.md'), 'Tests passed by operator.');
  const options = { 'approved-by': 'Test operator', evidence: 'evidence.md', 'backend-id': ids[0], 'frontend-id': ids[1] };
  await assert.rejects(approvePackage(c, { ...options, 'backend-id': ids[1] }), /diffère/);
  const record = await approvePackage(c, options);
  assert.equal(record.images.frontend.id, ids[1]);
  assert.equal(record.evidenceSha256.length, 64);
  await assert.rejects(approvePackage(c, options), /EEXIST/);
});
