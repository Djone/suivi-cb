const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('Istanbul loads YAML coverage configuration without the vulnerable sprintf-js chain', async () => {
  const fromLoader = createRequire(require.resolve('@istanbuljs/load-nyc-config'));
  assert.equal(fromLoader('js-yaml/package.json').version, '4.3.2');
  const fromYaml = createRequire(fromLoader.resolve('js-yaml'));
  assert.equal(fromYaml('argparse/package.json').version, '2.0.1');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'suivi-nyc-'));
  try {
    const config = path.join(dir, '.nycrc.yml');
    fs.writeFileSync(config, 'all: true\ninclude:\n  - controllers/**/*.js\nexclude:\n  - tests/**\n');
    const result = await require('@istanbuljs/load-nyc-config').loadNycConfig({ cwd: dir, nycrcPath: config });
    assert.equal(result.all, true);
    assert.deepEqual(result.include, ['controllers/**/*.js']);
    assert.deepEqual(result.exclude, ['tests/**']);
  } finally {
    // Only the explicitly created file and now-empty temporary directory.
    fs.unlinkSync(path.join(dir, '.nycrc.yml'));
    fs.rmdirSync(dir);
  }
});
