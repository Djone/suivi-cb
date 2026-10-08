const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const VERSION = /^\d+\.\d+\.\d+-rc\.[1-9]\d*$/;
const IMAGE_ID = /^sha256:[a-f0-9]{64}$/;
const FILES = ['images.tar', 'manifest.json', 'docker-compose.yml', 'inspection.json'];

function run(program, args, { capture = false, cwd = ROOT } = {}) {
  const result = spawnSync(program, args, {
    cwd, shell: false, encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${program} a échoué (${result.status ?? result.error?.message}). ${capture ? result.stderr || '' : ''}`);
  }
  return capture ? result.stdout.trim() : '';
}

function npm(args, execute) {
  // Only fixed test/build/audit arguments reach cmd.exe on Windows.
  if (process.platform === 'win32') execute('cmd.exe', ['/d', '/s', '/c', `npm ${args.join(' ')}`]);
  else execute('npm', args);
}

function hash(file) {
  // Stream large Docker archives instead of loading them into memory.
  return new Promise((resolve, reject) => {
    const digest = crypto.createHash('sha256');
    const stream = fs.createReadStream(file);
    stream.on('error', reject);
    stream.on('data', chunk => digest.update(chunk));
    stream.on('end', () => resolve(digest.digest('hex')));
  });
}

function config(options, root = ROOT) {
  if (!VERSION.test(options.candidate || '')) throw new Error('Candidate attendue : 2.2.0-rc.3 (nouveau numéro pour chaque construction).');
  const platform = options.platform || 'linux/amd64';
  if (!['linux/amd64', 'linux/arm64'].includes(platform)) throw new Error('Plateforme invalide.');
  const host = options.host || '192.168.1.113';
  const user = options.user || 'GodOfNasAugerie';
  const port = options.port || '1122';
  const remoteRoot = options['remote-root'] || '/volume1/docker/suivi-cb-preprod/releases';
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(host) || !/^[a-zA-Z0-9_][a-zA-Z0-9_.-]*$/.test(user)) throw new Error('Hôte/utilisateur SSH invalide.');
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error('Port SSH invalide.');
  if (!/^\/volume1\/[a-zA-Z0-9_/-]+$/.test(remoteRoot) || remoteRoot.split('/').includes('..') || remoteRoot.endsWith('/')) throw new Error('Dossier NAS invalide.');
  return {
    root, candidate: options.candidate, platform, host, user, port, remoteRoot,
    dir: path.join(root, '.cache', 'releases', options.candidate),
    tags: ['backend', 'frontend'].map(service => `suivi-cb-preprod-${service}:${options.candidate}`),
  };
}

function cleanCommit(c, execute) {
  const status = execute('git', ['status', '--porcelain', '--untracked-files=all'], { capture: true, cwd: c.root });
  if (status) throw new Error('Le dépôt doit être propre et le commit candidat préparé. Aucun fichier modifié/non suivi ne peut entrer dans la candidate.');
  return execute('git', ['rev-parse', 'HEAD'], { capture: true, cwd: c.root });
}

function compose(c, ids) {
  return `# Candidate imported from images.tar; never build here.
name: suivi-cb-preprod
services:
  backend:
    image: ${ids[0]}
    pull_policy: never
    container_name: suivi-cb-preprod-backend
    restart: unless-stopped
    env_file: [.env.preprod]
    environment:
      NODE_ENV: production
      PORT_BACK: "3001"
      DB_PATH: /app/data/database.db
    expose: ["3001"]
    volumes:
      - ./data:/app/data
      - ./logs/backend:/app/logs
    networks: [app]
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://127.0.0.1:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
  frontend:
    image: ${ids[1]}
    pull_policy: never
    container_name: suivi-cb-preprod-frontend
    restart: unless-stopped
    ports: ["127.0.0.1:4201:80"]
    depends_on:
      backend:
        condition: service_healthy
    networks: [app]
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://127.0.0.1:80"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
networks:
  app:
    driver: bridge
`;
}

async function buildPackage(c, execute = run) {
  const commit = cleanCommit(c, execute);
  // Reserve the directory. A failed construction is retained for diagnosis;
  // it cannot be overwritten and must get a new candidate number.
  fs.mkdirSync(path.dirname(c.dir), { recursive: true });
  fs.mkdirSync(c.dir);
  const existing = execute('docker', ['image', 'ls', '--format', '{{.Repository}}:{{.Tag}}'], { capture: true, cwd: c.root }).split(/\r?\n/);
  if (c.tags.some(tag => existing.includes(tag))) throw new Error('Un tag candidat existe déjà ; choisir une nouvelle candidate.');
  for (const args of [
    ['--prefix', 'backend', 'test'], ['--prefix', 'frontend', 'run', 'test:ci'],
    ['--prefix', 'frontend', 'run', 'build', '--', '--configuration', 'production'],
    ['--prefix', 'backend', 'audit', '--omit=dev'], ['--prefix', 'frontend', 'audit', '--omit=dev'],
  ]) npm(args, (p, a) => execute(p, a, { cwd: c.root }));
  if (cleanCommit(c, execute) !== commit) throw new Error('Le commit a changé pendant les contrôles.');
  const ids = [];
  for (const [i, service] of ['backend', 'frontend'].entries()) {
    execute('docker', ['build', '--platform', c.platform, '--label', `org.opencontainers.image.revision=${commit}`,
      '-f', `Dockerfile.${service}`, '-t', c.tags[i], '.'], { cwd: c.root });
    const image = JSON.parse(execute('docker', ['image', 'inspect', c.tags[i]], { capture: true, cwd: c.root }))[0];
    if (!IMAGE_ID.test(image.Id) || `${image.Os}/${image.Architecture}` !== c.platform) throw new Error('Identifiant/plateforme image invalide.');
    ids.push(image.Id);
  }
  if (cleanCommit(c, execute) !== commit) throw new Error('Sources modifiées pendant la construction ; candidate refusée.');
  execute('docker', ['save', '-o', path.join(c.dir, 'images.tar'), ...c.tags], { cwd: c.root });
  execute(process.execPath, [path.join(c.root, 'scripts', 'audit-image-archive.mjs'),
    path.join(c.dir, 'images.tar'), path.join(c.dir, 'inspection.json')], { capture: true, cwd: c.root });
  const inspection = JSON.parse(fs.readFileSync(path.join(c.dir, 'inspection.json'), 'utf8'));
  if (inspection.images?.length !== 2 || inspection.images.some(image =>
    image.sensitivePaths?.length || image.sourceDifferences?.length || !ids.includes(image.dockerImageId || image.configDigest)) ||
    !inspection.images.some(image => (image.dockerImageId || image.configDigest) === ids[1] && image.nginx?.matchesWorkspace && image.nginx?.silentSsoException)) {
    throw new Error('Inspection archive refusée : données embarquées, sources différentes ou configuration frontend incorrecte.');
  }
  const manifest = {
    schema: 1, candidate: c.candidate, commit, platform: c.platform, createdAt: new Date().toISOString(),
    devChecks: ['backend-tests', 'frontend-tests', 'frontend-build', 'backend-production-audit', 'frontend-production-audit'],
    archiveSha256: await hash(path.join(c.dir, 'images.tar')),
    images: Object.fromEntries(['backend', 'frontend'].map((service, i) => [service, { tag: c.tags[i], id: ids[i] }])),
  };
  fs.writeFileSync(path.join(c.dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(path.join(c.dir, 'docker-compose.yml'), compose(c, ids));
  const sums = await Promise.all(FILES.map(async file => `${await hash(path.join(c.dir, file))}  ${file}`));
  fs.writeFileSync(path.join(c.dir, 'SHA256SUMS'), sums.join('\n') + '\n');
  console.log(`Package créé : ${c.dir}. Pas encore validé en préproduction.`);
  return manifest;
}

async function readPackage(c) {
  const manifest = JSON.parse(fs.readFileSync(path.join(c.dir, 'manifest.json'), 'utf8'));
  if (manifest.schema !== 1 || manifest.candidate !== c.candidate || !/^[a-f0-9]{40,64}$/.test(manifest.commit) ||
      !['linux/amd64', 'linux/arm64'].includes(manifest.platform) ||
      !['backend', 'frontend'].every(s => IMAGE_ID.test(manifest.images?.[s]?.id))) throw new Error('Manifeste invalide.');
  const expected = fs.readFileSync(path.join(c.dir, 'SHA256SUMS'), 'utf8').trim().split(/\r?\n/);
  if (expected.length !== FILES.length) throw new Error('Liste des empreintes invalide.');
  for (const [i, file] of FILES.entries()) {
    if (expected[i] !== `${await hash(path.join(c.dir, file))}  ${file}`) throw new Error(`Package modifié : ${file}.`);
  }
  if (manifest.archiveSha256 !== await hash(path.join(c.dir, 'images.tar'))) throw new Error('Archive différente du manifeste.');
  if (fs.readFileSync(path.join(c.dir, 'docker-compose.yml'), 'utf8') !== compose(c, [manifest.images.backend.id, manifest.images.frontend.id])) throw new Error('Compose différent des images du manifeste.');
  return manifest;
}

async function transferPackage(c, execute = run) {
  await readPackage(c);
  const target = `${c.user}@${c.host}`;
  const final = `${c.remoteRoot}/${c.candidate}`;
  const staging = `${final}.upload-${crypto.randomBytes(6).toString('hex')}`;
  const lock = `${final}.upload-lock`;
  let locked = false;
  try {
    execute('ssh', ['-p', c.port, target,
      `set -eu; umask 077; mkdir -p '${c.remoteRoot}'; if [ -e '${final}' ]; then echo 'Candidate NAS deja presente : transfert refuse' >&2; exit 1; fi; mkdir '${lock}'`]);
    locked = true;
    execute('ssh', ['-p', c.port, target, `set -eu; umask 077; mkdir '${staging}'`]);
    execute('scp', ['-O', '-P', c.port, ...[...FILES, 'SHA256SUMS'].map(file => path.join(c.dir, file)), `${target}:${staging}/`]);
    execute('ssh', ['-p', c.port, target,
      `set -eu; cd '${staging}'; sha256sum -c SHA256SUMS; [ ! -e '${final}' ]; mv '${staging}' '${final}'`]);
    console.log(`Transfert vérifié : ${final}. Import et installation préproduction à effectuer séparément.`);
  } finally {
    if (locked) {
      try { execute('ssh', ['-p', c.port, target, `rmdir '${lock}'`]); }
      catch { console.error(`Verrou NAS conservé : ${lock}. Vérifier l'absence de transfert actif avant suppression.`); }
    }
  }
}

async function approvePackage(c, options) {
  const manifest = await readPackage(c);
  if (!options['approved-by']?.trim() || !options.evidence) throw new Error('Approbateur et fichier de compte rendu requis.');
  for (const service of ['backend', 'frontend']) {
    if (options[`${service}-id`] !== manifest.images[service].id) throw new Error(`L'image ${service} déclarée en préproduction diffère du package.`);
  }
  const evidence = path.resolve(c.root, options.evidence);
  if (!fs.statSync(evidence).isFile() || !fs.statSync(evidence).size) throw new Error('Compte rendu vide/invalide.');
  const record = {
    candidate: manifest.candidate, commit: manifest.commit, images: manifest.images,
    archiveSha256: manifest.archiveSha256, manifestSha256: await hash(path.join(c.dir, 'manifest.json')),
    approvedBy: options['approved-by'].trim(), approvedAt: new Date().toISOString(),
    evidenceSha256: await hash(evidence),
    declaration: 'Tests préproduction et sécurité validés ; promotion de ces images autorisée. Déclaration opérateur, sans vérification automatique du NAS.',
  };
  fs.writeFileSync(path.join(c.dir, 'approval.json'), JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
  console.log('Approbation enregistrée. Aucun déploiement production lancé. Suivre docs/PROMOTION_PREPROD_PRODUCTION.md.');
  return record;
}

async function main(argv) {
  const [command, ...args] = argv;
  const options = {};
  const allowed = new Set(['candidate', 'platform', 'host', 'user', 'port', 'remote-root', 'execute', 'backend-id', 'frontend-id', 'approved-by', 'evidence']);
  for (const arg of args) {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    if (!match || !allowed.has(match[1]) || Object.hasOwn(options, match[1])) throw new Error(`Option invalide : ${arg}`);
    if (match[1] === 'execute' && match[2] !== undefined) throw new Error('Utiliser --execute sans valeur.');
    options[match[1]] = match[2] ?? true;
  }
  if (!['ship', 'package', 'transfer', 'approve'].includes(command)) throw new Error('Commandes : ship, package, transfer, approve. Voir docs/AUTOMATISATION_CANDIDATE.md.');
  for (const [key, value] of Object.entries(options)) if (key !== 'execute' && typeof value !== 'string') throw new Error(`Valeur requise : --${key}=...`);
  const c = config(options);
  if (!options.execute) {
    console.log(JSON.stringify({ command, candidate: c.candidate, platform: c.platform, local: c.dir, nas: `${c.user}@${c.host}:${c.port}${c.remoteRoot}/${c.candidate}`, execute: false }, null, 2));
    console.log('Simulation : aucun test, build, transfert, approbation ou déploiement. Ajouter --execute pour agir.');
    return;
  }
  if (command === 'package' || command === 'ship') await buildPackage(c);
  if (command === 'transfer' || command === 'ship') await transferPackage(c);
  if (command === 'approve') await approvePackage(c, options);
}

module.exports = { config, compose, buildPackage, readPackage, transferPackage, approvePackage, main };
if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
