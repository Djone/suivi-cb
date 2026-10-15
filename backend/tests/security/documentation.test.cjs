const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const YAML = require('yaml');
const { DocumentationStore } = require('../../services/documentation-store');
const { createDocumentationRouter } = require('../../routes/documentation.routes');
const { isDocumentationEnabled, requireLocalDocumentationAccess } = require('../../middlewares/documentation-access.middleware');

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'suivi-cb-doc-test-'));
  const root = path.join(directory, 'docs');
  fs.mkdirSync(root);
  fs.writeFileSync(path.join(root, 'one.md'), '# Première page\n\n## Contrôles\n');
  fs.writeFileSync(path.join(root, 'two.md'), '# Deuxième page\n');
  t.after(() => {
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('suivi-cb-doc-test-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return { directory, root, store: new DocumentationStore(root) };
}

test('documentation is enabled only for local development and disabled in all deployed environments', () => {
  assert.equal(isDocumentationEnabled({}), true);
  assert.equal(isDocumentationEnabled({ NODE_ENV: 'development' }), true);
  for (const NODE_ENV of ['production', 'preproduction', 'preprod', 'staging', 'test']) {
    assert.equal(isDocumentationEnabled({ NODE_ENV }), false);
  }
  assert.equal(isDocumentationEnabled({ NODE_ENV: 'development', DOCUMENTATION_DISABLED: 'true' }), false);
  const old = process.env.NODE_ENV;
  const disabled = process.env.DOCUMENTATION_DISABLED;
  try {
    process.env.NODE_ENV = 'development';
    delete process.env.DOCUMENTATION_DISABLED;
    let code;
    requireLocalDocumentationAccess({ socket: { remoteAddress: '192.168.1.2' }, headers: { 'x-forwarded-for': '127.0.0.1' } },
      { status(value) { code = value; return this; }, json() {} }, () => assert.fail('Remote access allowed'));
    assert.equal(code, 403);
    process.env.NODE_ENV = 'production';
    requireLocalDocumentationAccess({ socket: { remoteAddress: '127.0.0.1' } },
      { status(value) { code = value; return this; }, json() {} }, () => assert.fail('Production access allowed'));
    assert.equal(code, 404);
  } finally {
    if (old === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = old;
    if (disabled === undefined) delete process.env.DOCUMENTATION_DISABLED; else process.env.DOCUMENTATION_DISABLED = disabled;
  }
});

test('publication updates the actual Markdown file and preserves unknown YAML metadata and comments', (t) => {
  const { root, store } = fixture(t);
  fs.writeFileSync(path.join(root, 'one.md'), '---\ntitle: Original\n# Preserve this comment\ncustom: retained\n---\n## Original\n');
  const before = store.read('docs/one.md');
  const updated = store.publish(before.id, { revision: before.revision, title: ' Nouveau ', summary: 'Résumé', category: 'Référentiels', body: '## Nouveau\n\n- [x] Validé\n' }, 'Auteur');
  const physical = fs.readFileSync(path.join(root, 'one.md'), 'utf8');
  assert.match(physical, /## Nouveau/);
  assert.match(physical, /# Preserve this comment/);
  assert.match(physical, /custom: retained/);
  const metadata = YAML.parse(physical.split('---\n')[1]);
  assert.equal(metadata.title, 'Nouveau');
  assert.equal(metadata.owner, 'Auteur');
  assert.equal(updated.status, 'published');
  assert.notEqual(updated.revision, before.revision);
  assert.equal(new DocumentationStore(root).read(before.id).body, updated.body);
});

test('creation makes a physical draft and deletion removes it while preserving the last file', (t) => {
  const { root, store } = fixture(t);
  const created = store.create('Auteur');
  assert.equal(created.status, 'draft');
  assert.ok(fs.existsSync(path.join(root, created.sourcePath)));
  store.remove(created.id, created.revision);
  assert.equal(fs.existsSync(path.join(root, created.sourcePath)), false);
  const first = store.read('docs/one.md');
  store.remove(first.id, first.revision);
  const last = store.read('docs/two.md');
  assert.throws(() => store.remove(last.id, last.revision), (error) => error.status === 409);
  assert.ok(fs.existsSync(path.join(root, 'two.md')));
});

test('external changes block both publication and deletion without losing repository content', (t) => {
  const { root, store } = fixture(t);
  const before = store.read('docs/one.md');
  fs.writeFileSync(path.join(root, 'one.md'), '## IDE edit\n');
  assert.throws(() => store.publish(before.id, { ...before, body: '## App edit' }, 'Auteur'), (error) => error.status === 409);
  assert.throws(() => store.remove(before.id, before.revision), (error) => error.status === 409);
  assert.equal(fs.readFileSync(path.join(root, 'one.md'), 'utf8'), '## IDE edit\n');
});

test('traversal, non-Markdown files and directory junctions cannot escape docs', (t) => {
  const { directory, root, store } = fixture(t);
  for (const id of ['docs/../private.md', 'docs/nested/../../private.md', 'docs/one.md:stream', 'docs/..\\private.md', 'docs/.env', 'docs//one.md', 'docs/.. /private.md', 'docs/NUL.md', 'docs/folder./private.md']) {
    assert.throws(() => store.read(id), (error) => error.status === 400);
  }
  const outside = path.join(directory, 'outside');
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'private.md'), 'private');
  fs.symlinkSync(outside, path.join(root, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => store.read('docs/escape/private.md'), (error) => error.status === 403);
  assert.equal(store.list().some((entry) => entry.sourcePath.startsWith('escape/')), false);
  fs.symlinkSync(outside, path.join(root, 'Notes-equipe'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => store.create('Auteur'), (error) => error.status === 403);
  assert.equal(fs.readFileSync(path.join(outside, 'private.md'), 'utf8'), 'private');
});

test('API validates mutations and returns the persisted document version', async (t) => {
  const { root, store } = fixture(t);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.auth = { name: 'Test Author' }; next(); });
  app.use('/api/documentation', createDocumentationRouter(store));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/documentation`;
  const request = (method, data) => fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const entry = (await (await fetch(url)).json())[0];
  assert.equal((await request('PUT', { ...entry, id: 'docs/../private.md' })).status, 400);
  const createdResponse = await request('POST', {});
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  const publishedResponse = await request('PUT', { id: created.id, revision: created.revision, title: 'Publié', summary: '', category: 'Notes d’équipe', body: '## Enregistré' });
  assert.equal(publishedResponse.status, 200);
  const published = await publishedResponse.json();
  assert.equal(published.owner, 'Test Author');
  assert.match(fs.readFileSync(path.join(root, created.sourcePath), 'utf8'), /## Enregistré/);
  assert.equal((await request('DELETE', { id: created.id, revision: created.revision })).status, 409);
  assert.equal((await request('DELETE', { id: created.id, revision: published.revision })).status, 204);
  assert.equal(fs.existsSync(path.join(root, created.sourcePath)), false);
});
