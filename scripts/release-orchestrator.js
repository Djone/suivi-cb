const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const REPORT_DIR = path.join(ROOT, 'data', 'release');
const BACKUP_DIR = path.join(REPORT_DIR, 'backups');
const ENV_DEV_FILE = path.join(ROOT, 'frontend', 'src', 'environments', 'environment.ts');
const ENV_PROD_FILE = path.join(ROOT, 'frontend', 'src', 'environments', 'environment.prod.ts');
const ROOT_PACKAGE_FILE = path.join(ROOT, 'package.json');
const VERSION_FILE = path.join(ROOT, 'frontend', 'src', 'app', 'version.ts');
const GEN_VERSION_FILE = path.join(ROOT, 'scripts', 'gen-version.js');

const SEMVER_STABLE = /^\d+\.\d+\.\d+$/;
const SEMVER_DEV = /^\d+\.\d+\.\d+-dev(?:\.\d+)?$/;
const COMMAND_TIMEOUT_MS = 10 * 60 * 1000;

const VERSION_FILES = [
  ROOT_PACKAGE_FILE,
  ENV_DEV_FILE,
  ENV_PROD_FILE,
  VERSION_FILE,
];

function parseArgs(argv) {
  const command = argv[2] || 'dry-run';
  const options = {
    stable: '',
    next: '',
    branch: 'master',
    report: path.join(REPORT_DIR, 'last-report.json'),
    backupFile: '',

    allowDirty: false,
    skipMasterCheck: false,
    skipTests: false,
    skipBuild: false,
    execute: false,

    createReleaseBranch: false,
    releaseBranch: '',
    branchPrefix: 'release/',
    commit: false,
    tag: false,

    rollbackOnFailure: false,
  };

  for (const raw of argv.slice(3)) {
    if (!raw.startsWith('--')) continue;

    const [k, ...rest] = raw.slice(2).split('=');
    const v = rest.join('=');

    switch (k) {
      case 'stable':
        options.stable = v;
        break;
      case 'next':
        options.next = v;
        break;
      case 'branch':
        options.branch = v || 'master';
        break;
      case 'report':
        options.report = v ? path.resolve(ROOT, v) : options.report;
        break;
      case 'backup-file':
        options.backupFile = v ? path.resolve(ROOT, v) : '';
        break;

      case 'allow-dirty':
        options.allowDirty = true;
        break;
      case 'skip-master-check':
        options.skipMasterCheck = true;
        break;
      case 'skip-tests':
        options.skipTests = true;
        break;
      case 'skip-build':
        options.skipBuild = true;
        break;
      case 'execute':
        options.execute = true;
        break;
      case 'create-release-branch':
        options.createReleaseBranch = true;
        break;
      case 'release-branch':
        options.releaseBranch = v;
        break;
      case 'branch-prefix':
        options.branchPrefix = v || 'release/';
        break;
      case 'commit':
        options.commit = true;
        break;
      case 'tag':
        options.tag = true;
        break;

      case 'rollback-on-failure':
        options.rollbackOnFailure = true;
        break;

      default:
        break;
    }
  }

  return { command, options };
}

function nowIso() {
  return new Date().toISOString();
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function runCommand(cmd, opts = {}) {
  const result = spawnSync(cmd, {
    shell: true,
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...(opts.env || {}) },
    timeout: opts.timeoutMs || COMMAND_TIMEOUT_MS,
  });

  const timedOut = Boolean(result.error && result.error.code === 'ETIMEDOUT');
  return {
    ok: result.status === 0 && !timedOut,
    code: result.status,
    stdout: result.stdout || '',
    stderr: (result.stderr || '') + (timedOut ? '\nCommand timed out.' : ''),
    cmd,
    timedOut,
  };
}

function runCommandLive(cmd, opts = {}) {
  console.log(`[release] $ ${cmd}`);
  const result = spawnSync(cmd, {
    shell: true,
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...(opts.env || {}) },
    stdio: 'inherit',
    timeout: opts.timeoutMs || COMMAND_TIMEOUT_MS,
  });

  const timedOut = Boolean(result.error && result.error.code === 'ETIMEDOUT');
  return {
    ok: result.status === 0 && !timedOut,
    code: result.status,
    stdout: '',
    stderr: timedOut ? 'Command timed out.' : '',
    cmd,
    timedOut,
  };
}

function toDurationMs(start) {
  return Date.now() - start;
}

function safeName(text) {
  return text.replace(/[^a-zA-Z0-9._-]/g, '-');
}

function writeReport(report, reportFile) {
  ensureDir(path.dirname(reportFile));
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n', 'utf8');

  const archiveName = `report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(path.join(REPORT_DIR, archiveName), JSON.stringify(report, null, 2) + '\n', 'utf8');
}

function addStep(report, step) {
  report.steps.push(step);
}

function failStep(report, id, start, error) {
  addStep(report, {
    id,
    status: 'failed',
    startedAt: new Date(start).toISOString(),
    finishedAt: nowIso(),
    durationMs: toDurationMs(start),
    error: error instanceof Error ? error.message : String(error),
  });
  report.result = 'failed';
}

function passStep(report, id, start, details = {}) {
  addStep(report, {
    id,
    status: 'passed',
    startedAt: new Date(start).toISOString(),
    finishedAt: nowIso(),
    durationMs: toDurationMs(start),
    details,
  });
}

function skipStep(report, id, reason) {
  addStep(report, {
    id,
    status: 'skipped',
    startedAt: nowIso(),
    finishedAt: nowIso(),
    durationMs: 0,
    details: { reason },
  });
}

function readFileOrEmpty(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, 'utf8');
}

function createVersionBackup(options) {
  ensureDir(BACKUP_DIR);

  const snapshot = {
    createdAt: nowIso(),
    stable: options.stable,
    next: options.next,
    files: VERSION_FILES.map((filePath) => ({
      path: path.relative(ROOT, filePath).replace(/\\/g, '/'),
      content: readFileOrEmpty(filePath),
    })),
  };

  const backupName = `version-backup-${new Date().toISOString().replace(/[:.]/g, '-')}-${safeName(options.stable || 'unknown')}.json`;
  const backupPath = path.join(BACKUP_DIR, backupName);
  fs.writeFileSync(backupPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
  return backupPath;
}

function findLatestBackupPath() {
  if (!fs.existsSync(BACKUP_DIR)) {
    return null;
  }
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => path.join(BACKUP_DIR, name));

  if (!files.length) {
    return null;
  }

  files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return files[0];
}

function restoreBackup(backupPath) {
  const raw = fs.readFileSync(backupPath, 'utf8');
  const parsed = JSON.parse(raw);

  for (const file of parsed.files || []) {
    const abs = path.resolve(ROOT, file.path);
    ensureDir(path.dirname(abs));

    if (file.content === null || typeof file.content === 'undefined') {
      if (fs.existsSync(abs)) {
        fs.unlinkSync(abs);
      }
    } else {
      fs.writeFileSync(abs, file.content, 'utf8');
    }
  }

  return parsed;
}

function setEnvVersion(filePath, nextVersion) {
  const content = fs.readFileSync(filePath, 'utf8');
  const updated = content.replace(/(version:\s*')[^']+(')/, `$1${nextVersion}$2`);
  if (content === updated) {
    throw new Error(`Unable to update version in ${path.relative(ROOT, filePath)}.`);
  }
  fs.writeFileSync(filePath, updated, 'utf8');
}

function setRootPackageVersion(nextVersion) {
  const pkg = JSON.parse(fs.readFileSync(ROOT_PACKAGE_FILE, 'utf8'));
  pkg.version = nextVersion;
  fs.writeFileSync(ROOT_PACKAGE_FILE, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
}

function preflight(report, options) {
  let start = Date.now();
  try {
    const gitRepo = runCommand('git rev-parse --is-inside-work-tree');
    if (!gitRepo.ok) {
      throw new Error('Not inside a git repository.');
    }

    const branch = runCommand('git rev-parse --abbrev-ref HEAD');
    const branchName = branch.stdout.trim();
    const status = runCommand('git status --porcelain');
    const dirty = status.stdout.trim().length > 0;

    if (dirty && !options.allowDirty) {
      throw new Error('Working tree is dirty. Commit/stash or use --allow-dirty.');
    }

    passStep(report, 'preflight-git', start, {
      branch: branchName,
      dirty,
      allowDirty: options.allowDirty,
    });

    start = Date.now();
    if (options.skipMasterCheck) {
      skipStep(report, 'preflight-master-check', 'skip requested');
      return;
    }

    const checkCmd = process.platform === 'win32'
      ? `powershell -ExecutionPolicy Bypass -File scripts/check-master-status.ps1 -Branch ${options.branch}`
      : `bash scripts/check-master-status.sh ${options.branch}`;

    const check = runCommand(checkCmd);
    if (!check.ok) {
      throw new Error(check.stderr || check.stdout || 'master check failed');
    }

    passStep(report, 'preflight-master-check', start, {
      branch: options.branch,
      output: check.stdout.trim().slice(-3000),
    });
  } catch (error) {
    failStep(report, report.steps.length ? 'preflight-master-check' : 'preflight-git', start, error);
    throw error;
  }
}

function verify(report, options) {
  const start = Date.now();
  if (options.skipTests) {
    skipStep(report, 'verify-tests', 'skip requested');
    return;
  }

  console.log('[release] Step: verify-tests');
  const test = runCommandLive('npm test', {
    env: {
      BROWSERSLIST_IGNORE_OLD_DATA: 'true',
      BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA: 'true',
    },
  });
  if (!test.ok) {
    const failureReason = test.timedOut
      ? `Tests command timed out after ${Math.round(COMMAND_TIMEOUT_MS / 60000)} minutes.`
      : test.stderr || test.stdout || 'tests failed';
    failStep(report, 'verify-tests', start, failureReason);
    throw new Error('Tests failed.');
  }

  passStep(report, 'verify-tests', start, {
    output: test.stdout.trim().slice(-3000),
  });
}

function prepareVersions(report, options) {
  const start = Date.now();
  if (!options.stable || !options.next) {
    failStep(
      report,
      'prepare-versions',
      start,
      'Missing versions. Use --stable=x.y.z --next=x.y.z-dev',
    );
    throw new Error('Missing required version arguments.');
  }

  if (!SEMVER_STABLE.test(options.stable)) {
    failStep(report, 'prepare-versions', start, `Invalid stable version: ${options.stable}`);
    throw new Error('Invalid stable version.');
  }

  if (!SEMVER_DEV.test(options.next)) {
    failStep(report, 'prepare-versions', start, `Invalid next dev version: ${options.next}`);
    throw new Error('Invalid next dev version.');
  }

  setRootPackageVersion(options.next);
  setEnvVersion(ENV_DEV_FILE, options.next);
  setEnvVersion(ENV_PROD_FILE, options.stable);

  const genVersion = runCommand(`node ${path.relative(ROOT, GEN_VERSION_FILE)}`, {
    env: { NODE_ENV: 'development' },
  });

  if (!genVersion.ok) {
    failStep(report, 'prepare-versions', start, genVersion.stderr || 'version file generation failed');
    throw new Error('Unable to regenerate frontend version.ts');
  }

  passStep(report, 'prepare-versions', start, {
    stableVersion: options.stable,
    nextDevVersion: options.next,
    filesUpdated: VERSION_FILES.map((f) => path.relative(ROOT, f)),
  });
}

function gitPrepare(report, options) {
  let start = Date.now();
  const details = {};

  if (options.createReleaseBranch) {
    const branchName = options.releaseBranch || `${options.branchPrefix}${options.stable}`;
    const createBranch = runCommand(`git checkout -b ${branchName}`);
    if (!createBranch.ok) {
      failStep(report, 'git-create-branch', start, createBranch.stderr || createBranch.stdout || 'branch creation failed');
      throw new Error('Unable to create release branch.');
    }
    details.branchName = branchName;
    passStep(report, 'git-create-branch', start, details);
  } else {
    skipStep(report, 'git-create-branch', 'disabled');
  }

  start = Date.now();
  if (options.commit) {
    const add = runCommand(
      `git add ${VERSION_FILES.map((filePath) => path.relative(ROOT, filePath)).join(' ')}`,
    );
    if (!add.ok) {
      failStep(report, 'git-commit', start, add.stderr || add.stdout || 'git add failed');
      throw new Error('Unable to stage version files.');
    }

    const message = `chore(release): prepare ${options.stable} and start ${options.next}`;
    const commit = runCommand(`git commit -m "${message.replace(/"/g, '\\"')}"`);
    if (!commit.ok) {
      failStep(report, 'git-commit', start, commit.stderr || commit.stdout || 'git commit failed');
      throw new Error('Unable to commit release changes.');
    }

    passStep(report, 'git-commit', start, { message });
  } else {
    skipStep(report, 'git-commit', 'disabled');
  }

  start = Date.now();
  if (options.tag) {
    const tagName = `v${options.stable}`;
    const tag = runCommand(`git tag -a ${tagName} -m "Release ${options.stable}"`);
    if (!tag.ok) {
      failStep(report, 'git-tag', start, tag.stderr || tag.stdout || 'git tag failed');
      throw new Error('Unable to tag release.');
    }

    passStep(report, 'git-tag', start, { tagName });
  } else {
    skipStep(report, 'git-tag', 'disabled');
  }
}

function gitMergeToMaster(report) {
  const start = Date.now();

  const currentBranch = runCommand('git rev-parse --abbrev-ref HEAD');
  if (!currentBranch.ok) {
    failStep(report, 'git-merge-master', start, currentBranch.stderr || 'unable to read current branch');
    throw new Error('Unable to read current branch.');
  }

  const sourceBranch = currentBranch.stdout.trim();
  if (!sourceBranch || sourceBranch === 'master') {
    skipStep(report, 'git-merge-master', sourceBranch === 'master'
      ? 'already on master'
      : 'unable to determine source branch');
    skipStep(report, 'git-push-master', 'merge not required');
    return;
  }

  const fetch = runCommand('git fetch origin');
  if (!fetch.ok) {
    failStep(report, 'git-merge-master', start, fetch.stderr || fetch.stdout || 'git fetch failed');
    throw new Error('Unable to fetch origin.');
  }

  const checkoutMaster = runCommand('git checkout master');
  if (!checkoutMaster.ok) {
    failStep(report, 'git-merge-master', start, checkoutMaster.stderr || checkoutMaster.stdout || 'git checkout master failed');
    throw new Error('Unable to checkout master.');
  }

  const syncMaster = runCommand('git pull --ff-only origin master');
  if (!syncMaster.ok) {
    runCommand(`git checkout ${sourceBranch}`);
    failStep(report, 'git-merge-master', start, syncMaster.stderr || syncMaster.stdout || 'git pull --ff-only failed');
    throw new Error('Unable to fast-forward local master from origin.');
  }

  const mergeCmd = `git merge --no-ff ${sourceBranch} -m "chore(release): merge ${sourceBranch} into master"`;
  const merge = runCommand(mergeCmd);
  if (!merge.ok) {
    runCommand(`git checkout ${sourceBranch}`);
    failStep(report, 'git-merge-master', start, merge.stderr || merge.stdout || 'git merge failed');
    throw new Error('Unable to merge source branch into master.');
  }

  passStep(report, 'git-merge-master', start, {
    sourceBranch,
    targetBranch: 'master',
  });

  const pushStart = Date.now();
  const push = runCommand('git push origin master');
  if (!push.ok) {
    failStep(report, 'git-push-master', pushStart, push.stderr || push.stdout || 'git push failed');
    throw new Error('Unable to push master to origin.');
  }

  passStep(report, 'git-push-master', pushStart, {
    remote: 'origin',
    branch: 'master',
  });
}

function finalizeForDeployment(report, options) {
  // Deployment pipeline is now validation + Git integration only.
  skipStep(
    report,
    'deploy-build',
    options.skipBuild ? 'skip requested' : 'disabled (pipeline validates and merges only)',
  );
  skipStep(report, 'deploy-nas', 'disabled (NAS deployment removed from pipeline)');
}

function rollbackCommand(report, options) {
  const start = Date.now();

  const backupPath = options.backupFile || findLatestBackupPath();
  if (!backupPath) {
    failStep(report, 'rollback', start, 'No backup file found.');
    throw new Error('No backup file found for rollback.');
  }

  const parsed = restoreBackup(backupPath);
  passStep(report, 'rollback', start, {
    backupPath: path.relative(ROOT, backupPath),
    files: (parsed.files || []).map((f) => f.path),
  });
}

function run() {
  const { command, options } = parseArgs(process.argv);
  ensureDir(REPORT_DIR);
  ensureDir(BACKUP_DIR);

  const report = {
    tool: 'release-orchestrator',
    command,
    startedAt: nowIso(),
    finishedAt: '',
    result: 'passed',
    options,
    backupPath: '',
    steps: [],
  };

  try {
    if (command === 'dry-run') {
      preflight(report, options);
      verify(report, options);
    } else if (command === 'prepare') {
      preflight(report, options);
      verify(report, options);
      report.backupPath = createVersionBackup(options);
      prepareVersions(report, options);
      gitPrepare(report, options);
    } else if (command === 'deploy') {
      preflight(report, options);
      verify(report, options);
      finalizeForDeployment(report, options);
      if (options.execute) {
        gitMergeToMaster(report);
      } else {
        skipStep(report, 'git-merge-master', 'dry-run (use --execute to run merge)');
        skipStep(report, 'git-push-master', 'dry-run (use --execute to run push)');
      }
    } else if (command === 'full') {
      preflight(report, options);
      verify(report, options);
      report.backupPath = createVersionBackup(options);
      prepareVersions(report, options);
      gitPrepare(report, options);
      finalizeForDeployment(report, options);
      if (options.execute) {
        gitMergeToMaster(report);
      } else {
        skipStep(report, 'git-merge-master', 'dry-run (use --execute to run merge)');
        skipStep(report, 'git-push-master', 'dry-run (use --execute to run push)');
      }
    } else if (command === 'rollback') {
      rollbackCommand(report, options);
    } else {
      throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    report.result = 'failed';

    if (options.rollbackOnFailure && report.backupPath) {
      const rbStart = Date.now();
      try {
        restoreBackup(report.backupPath);
        passStep(report, 'rollback-on-failure', rbStart, {
          backupPath: path.relative(ROOT, report.backupPath),
        });
      } catch (rbError) {
        failStep(report, 'rollback-on-failure', rbStart, rbError);
      }
    }

    if (report.steps.length === 0) {
      addStep(report, {
        id: 'bootstrap',
        status: 'failed',
        startedAt: report.startedAt,
        finishedAt: nowIso(),
        durationMs: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  report.finishedAt = nowIso();
  writeReport(report, options.report);

  const summary = `Release ${command}: ${report.result}. Report: ${path.relative(ROOT, options.report)}`;
  console.log(summary);

  if (report.result !== 'passed') {
    process.exit(1);
  }
}

run();
