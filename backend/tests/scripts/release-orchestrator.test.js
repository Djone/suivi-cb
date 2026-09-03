const { resolveStableVersionForTag } = require('../../../scripts/release-orchestrator');

describe('release orchestrator tag version', () => {
  test('uses the source development branch instead of a stale UI value', () => {
    expect(resolveStableVersionForTag({ stable: '1.7.0' }, '1.6.0-dev')).toBe('1.6.0');
  });

  test('extracts the version from a dedicated release branch', () => {
    expect(resolveStableVersionForTag({ stable: '' }, 'release/1.6.0')).toBe('1.6.0');
  });

  test('falls back to an explicit stable version for a custom branch', () => {
    expect(resolveStableVersionForTag({ stable: '1.6.0' }, 'custom-release')).toBe('1.6.0');
  });

  test('returns no version when neither source is valid', () => {
    expect(resolveStableVersionForTag({ stable: '1.7.0-dev' }, 'custom-release')).toBe('');
  });
});
