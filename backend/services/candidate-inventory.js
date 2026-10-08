const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execute = promisify(execFile);

function nextCandidate(stable, names) {
  if (!/^\d+\.\d+\.\d+$/.test(stable)) throw new Error('Version stable invalide.');
  const pattern = new RegExp(`(?:^|[^\\d.])${stable.replace(/\./g, '\\.')}-rc\\.?([1-9]\\d*)(?=$|[^\\d])`);
  const numbers = names.map(name => pattern.exec(name)).filter(Boolean).map(match => Number(match[1]));
  if (numbers.some(n => !Number.isSafeInteger(n))) throw new Error('Numéro hors limites.');
  const latest = Math.max(0, ...numbers);
  if (!Number.isSafeInteger(latest + 1)) throw new Error('Numéro hors limites.');
  return { stable, latestNumber: latest, next: `${stable}-rc.${latest + 1}` };
}

async function candidateInventory(root, stable, docker = execute) {
  nextCandidate(stable, []);
  const names = [];
  for (const directory of [root, path.join(root, '.cache', 'releases')]) {
    try { names.push(...await fs.readdir(directory)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  let dockerAvailable = true;
  try {
    const result = await docker('docker', ['image', 'ls', '--format', '{{.Repository}}:{{.Tag}}'], { timeout: 5000, maxBuffer: 1024 * 1024 });
    names.push(...result.stdout.split(/\r?\n/).filter(tag => /^suivi-cb-preprod-(backend|frontend):/.test(tag)));
  } catch { dockerAvailable = false; }
  return { ...nextCandidate(stable, names), dockerAvailable,
    scope: 'Packages et fichiers locaux, tags Docker locaux. Le NAS distant n’est pas interrogé.' };
}

module.exports = { nextCandidate, candidateInventory };
