import process from 'node:process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function productionRealm(source, applicationUrl) {
  const url = new URL(applicationUrl);
  if (url.protocol !== 'https:' || url.username || url.password ||
      url.search || url.hash || url.pathname !== '/' ||
      url.hostname === 'localhost' || url.hostname === '127.0.0.1' ||
      url.hostname === '[::1]' || applicationUrl.includes('*')) {
    throw new Error('Utiliser une origine HTTPS publique sans chemin, paramètres ou wildcard.');
  }
  const realm = structuredClone(source);
  const client = realm.clients.find(item => item.clientId === 'suivi-cb-web');
  if (!client) throw new Error('Client suivi-cb-web absent du realm source.');
  client.redirectUris = [url.origin + '/home', url.origin + '/silent-check-sso.html'];
  client.webOrigins = [url.origin];
  client.attributes['post.logout.redirect.uris'] = url.origin + '/login';
  realm.sslRequired = 'external';
  return realm;
}

async function main() {
  const [applicationUrl, output] = process.argv.slice(2);
  if (!applicationUrl || process.argv.length > 4) {
    throw new Error('Usage: node prepare-production.mjs https://finances.example.com [fichier.json]');
  }
  const source = JSON.parse(await readFile(new URL('./realms/suivi-cb-dev.json', import.meta.url), 'utf8'));
  const destination = output ? resolve(output) : fileURLToPath(new URL('./realms/suivi-cb-prod.json', import.meta.url));
  await writeFile(destination, JSON.stringify(productionRealm(source, applicationUrl), null, 2) + '\n', { flag: 'wx' });
  console.log('Realm de production créé : ' + destination);
  console.log('Importer ce fichier via Create realm dans la console Keycloak. Aucun utilisateur n’est créé.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error.code === 'EEXIST' ? 'Le fichier existe déjà. Choisir un autre fichier de sortie pour préserver sa configuration.' : error.message);
    process.exitCode = 1;
  });
}
