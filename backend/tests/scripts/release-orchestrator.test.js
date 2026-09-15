const { gitMergeToMaster, resolveStableVersionForTag } = require('../../../scripts/release-orchestrator');

describe('release merge recovery', () => {
  const ok = (stdout = '') => ({ ok: true, stdout, stderr: '' });
  const failed = (stderr = '') => ({ ok: false, stdout: '', stderr });

  function scenario(overrides = {}) {
    let merging = false;
    const runGit = jest.fn((cmd) => {
      if (Object.prototype.hasOwnProperty.call(overrides, cmd)) return overrides[cmd];
      if (cmd === 'git rev-parse --abbrev-ref HEAD') return ok('2.0.0-dev\n');
      if (cmd === 'git rev-parse -q --verify MERGE_HEAD') return merging ? ok('release-sha') : failed();
      if (cmd.startsWith('git merge --no-ff')) {
        merging = true;
        return failed('CONFLICT in version.ts');
      }
      if (cmd === 'git merge --abort') merging = false;
      return ok();
    });
    const report = { result: 'passed', steps: [] };
    return { runGit, report };
  }

  test('aborts a conflicting merge before returning to the release branch, without pushing', () => {
    const { runGit, report } = scenario();
    expect(() => gitMergeToMaster(report, runGit)).toThrow('Unable to merge');
    const commands = runGit.mock.calls.map(([cmd]) => cmd);
    expect(commands.slice(-2)).toEqual(['git merge --abort', 'git checkout 2.0.0-dev']);
    expect(commands).not.toContain('git push origin master');
    expect(report.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'git-merge-master', status: 'failed' }),
      expect.objectContaining({ id: 'git-restore-source', status: 'passed' }),
    ]));
  });

  test.each(['git merge --abort', 'git checkout 2.0.0-dev'])('reports recovery failure at %s', (cmd) => {
    const { runGit, report } = scenario({ [cmd]: failed('recovery failed') });
    expect(() => gitMergeToMaster(report, runGit)).toThrow('Unable to merge');
    expect(report.steps).toContainEqual(expect.objectContaining({
      id: 'git-restore-source', status: 'failed', error: 'recovery failed',
    }));
    if (cmd === 'git merge --abort') {
      expect(runGit).not.toHaveBeenCalledWith('git checkout 2.0.0-dev');
    }
  });

  test('returns to the release branch when fast-forward fails, without aborting a nonexistent merge', () => {
    const { runGit, report } = scenario({ 'git pull --ff-only origin master': failed('diverged') });
    expect(() => gitMergeToMaster(report, runGit)).toThrow('Unable to fast-forward');
    expect(runGit).toHaveBeenCalledWith('git checkout 2.0.0-dev');
    expect(runGit).not.toHaveBeenCalledWith('git merge --abort');
  });

  test.each([
    { 'git status --porcelain': ok(' M package.json') },
    { 'git rev-parse -q --verify MERGE_HEAD': ok('existing-merge') },
  ])('rejects an unsafe starting state before switching branches', (overrides) => {
    const { runGit, report } = scenario(overrides);
    expect(() => gitMergeToMaster(report, runGit)).toThrow('clean working tree');
    expect(runGit).not.toHaveBeenCalledWith('git checkout master');
  });
});

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
