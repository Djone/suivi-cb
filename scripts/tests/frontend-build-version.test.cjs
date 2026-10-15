const { test } = require('node:test');
const assert = require('node:assert/strict');
const { metadata } = require('../../frontend/tools/write-build-version.cjs');

test('release metadata uses the candidate identity and production environment', () => {
  const result = metadata('2.2.0-rc.4', '2026-10-15T08:00:00.000Z');
  assert.match(result, /APP_VERSION = "2.2.0-rc.4"/);
  assert.match(result, /APP_ENV = "production"/);
  assert.doesNotMatch(result, /2.3.0-dev/);
});
test('invalid versions or timestamps fail before writing release metadata', () => {
  for (const version of ['2.3.0-dev', '2.2.0-rc.0', "2.2.0';bad"]) assert.throws(() => metadata(version, '2026-10-15T08:00:00.000Z'));
  assert.throws(() => metadata('2.2.0', 'invalid'));
});
