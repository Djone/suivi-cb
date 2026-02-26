const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const RELEASE_SCRIPT_PATH = path.join(ROOT_DIR, 'scripts', 'release-orchestrator.js');
const RELEASE_REPORT_PATH = path.join(ROOT_DIR, 'data', 'release', 'last-report.json');

const ALLOWED_COMMANDS = new Set(['dry-run', 'prepare', 'deploy', 'full', 'rollback']);
const MAX_LOG_LINES = 300;

let activeRun = null;
let lastRun = null;
let runCounter = 0;

function appendLogLine(buffer, source, line) {
  if (!line.trim()) {
    return;
  }
  buffer.push({ at: new Date().toISOString(), source, line });
  if (buffer.length > MAX_LOG_LINES) {
    buffer.shift();
  }
}

function addOutput(buffer, source, text) {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    appendLogLine(buffer, source, line);
  }
}

function parseBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function readLastReport() {
  try {
    if (!fs.existsSync(RELEASE_REPORT_PATH)) {
      return null;
    }
    const raw = fs.readFileSync(RELEASE_REPORT_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return {
      parseError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function buildArgs(payload) {
  const command = typeof payload.command === 'string' ? payload.command : '';
  if (!ALLOWED_COMMANDS.has(command)) {
    throw new Error('Invalid command. Allowed: dry-run, prepare, deploy, full, rollback.');
  }

  const args = [RELEASE_SCRIPT_PATH, command];

  const appendText = (apiKey, cliFlag) => {
    const value = payload[apiKey];
    if (typeof value === 'string' && value.trim()) {
      args.push(`--${cliFlag}=${value.trim()}`);
    }
  };

  appendText('stable', 'stable');
  appendText('next', 'next');
  appendText('branch', 'branch');
  appendText('report', 'report');
  appendText('backupFile', 'backup-file');
  appendText('releaseBranch', 'release-branch');
  appendText('branchPrefix', 'branch-prefix');

  const boolFlags = [
    ['allowDirty', 'allow-dirty'],
    ['skipMasterCheck', 'skip-master-check'],
    ['skipTests', 'skip-tests'],
    ['skipBuild', 'skip-build'],
    ['execute', 'execute'],
    ['withNasDeploy', 'with-nas-deploy'],
    ['createReleaseBranch', 'create-release-branch'],
    ['commit', 'commit'],
    ['tag', 'tag'],
    ['rollbackOnFailure', 'rollback-on-failure'],
  ];

  for (const [apiKey, cliFlag] of boolFlags) {
    if (parseBoolean(payload[apiKey])) {
      args.push(`--${cliFlag}`);
    }
  }

  return { command, args };
}

function toResponseShape(runState) {
  if (!runState) {
    return null;
  }

  return {
    id: runState.id,
    command: runState.command,
    startedAt: runState.startedAt,
    endedAt: runState.endedAt,
    status: runState.status,
    exitCode: runState.exitCode,
    options: runState.options,
    logs: runState.logs,
  };
}

exports.getReleaseStatus = (req, res) => {
  res.status(200).json({
    running: Boolean(activeRun),
    activeRun: toResponseShape(activeRun),
    lastRun: toResponseShape(lastRun),
    lastReport: readLastReport(),
  });
};

exports.runReleaseCommand = (req, res) => {
  if (activeRun) {
    return res.status(409).json({
      message: 'A release command is already running.',
      activeRun: toResponseShape(activeRun),
    });
  }

  if (!fs.existsSync(RELEASE_SCRIPT_PATH)) {
    return res.status(500).json({
      message: 'Release script not found.',
      path: RELEASE_SCRIPT_PATH,
    });
  }

  let command;
  let args;
  try {
    const parsed = buildArgs(req.body || {});
    command = parsed.command;
    args = parsed.args;
  } catch (error) {
    return res.status(400).json({
      message: error instanceof Error ? error.message : 'Invalid release payload.',
    });
  }

  runCounter += 1;

  const runState = {
    id: `release-${runCounter}`,
    command,
    startedAt: new Date().toISOString(),
    endedAt: null,
    status: 'running',
    exitCode: null,
    options: req.body || {},
    logs: [],
  };

  const child = spawn(process.execPath, args, {
    cwd: ROOT_DIR,
    env: process.env,
  });

  activeRun = runState;

  child.stdout.on('data', (chunk) => addOutput(runState.logs, 'stdout', chunk.toString()));
  child.stderr.on('data', (chunk) => addOutput(runState.logs, 'stderr', chunk.toString()));

  child.on('error', (error) => {
    appendLogLine(runState.logs, 'stderr', error instanceof Error ? error.message : String(error));
  });

  child.on('close', (exitCode) => {
    runState.endedAt = new Date().toISOString();
    runState.exitCode = typeof exitCode === 'number' ? exitCode : 1;
    runState.status = runState.exitCode === 0 ? 'passed' : 'failed';

    lastRun = runState;
    activeRun = null;
  });

  return res.status(202).json({
    message: 'Release command started.',
    run: toResponseShape(runState),
  });
};
