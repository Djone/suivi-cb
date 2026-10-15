const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const YAML = require('yaml');

function failure(status, message) {
  return Object.assign(new Error(message), { status });
}

function categoryFor(sourcePath) {
  if (/SUMMARY|NOTES|AUDIT_SECURITE_\d/i.test(sourcePath)) return 'Notes d’équipe';
  if (/README|FICHIERS|HARMONISATION|KEYCLOAK\.md|replace-material/i.test(sourcePath)) return 'Référentiels';
  return 'Modes opératoires';
}

function text(value, fallback = '') {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
}

function revision(raw) { return createHash('sha256').update(raw).digest('hex'); }

function parse(raw) {
  const normalized = raw.toString('utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  const yaml = YAML.parseDocument(match ? match[1] : '');
  if (yaml.errors.length || (yaml.contents && !YAML.isMap(yaml.contents))) {
    throw failure(422, 'Le front matter YAML du document est invalide. Corrigez-le dans le dépôt.');
  }
  return { body: match ? normalized.slice(match[0].length) : normalized, yaml };
}

/** Synchronous filesystem operations serialize API writes within this local process. */
class DocumentationStore {
  constructor(root = path.resolve(__dirname, '../../docs')) { this.root = path.resolve(root); }

  safeRoot() {
    const stat = fs.lstatSync(this.root);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw failure(403, 'Le dossier documentaire doit être un dossier physique du dépôt.');
    return fs.realpathSync(this.root);
  }

  resolve(id) {
    if (typeof id !== 'string' || !id.startsWith('docs/')) throw failure(400, 'Identifiant documentaire invalide.');
    const relative = id.slice(5);
    const segments = relative.split('/');
    if (!/\.md$/i.test(relative) || relative.includes('\\') || relative.includes(':') || relative.includes('\0') ||
      segments.some((segment) => !segment || segment === '.' || segment === '..' ||
        /[. ]$/.test(segment) || /[<>"|?*\u0000-\u001f]/.test(segment) ||
        /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(segment))) {
      throw failure(400, 'Chemin documentaire invalide.');
    }
    const root = this.safeRoot();
    const file = path.resolve(root, ...segments);
    if (!file.startsWith(root + path.sep)) throw failure(403, 'Chemin hors du dossier documentaire.');
    let current = root;
    for (const [index, segment] of segments.entries()) {
      current = path.join(current, segment);
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink() || (index < segments.length - 1 ? !stat.isDirectory() : !stat.isFile())) {
        throw failure(403, 'Les liens symboliques et fichiers spéciaux ne sont pas accessibles.');
      }
    }
    return { file, sourcePath: relative };
  }

  files() {
    const root = this.safeRoot();
    const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      .flatMap((entry) => {
        if (entry.isSymbolicLink()) return [];
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) return walk(file);
        return entry.isFile() && /\.md$/i.test(entry.name) ? [`docs/${path.relative(root, file).split(path.sep).join('/')}`] : [];
      });
    return walk(root);
  }

  read(id) {
    const { file, sourcePath } = this.resolve(id);
    if (fs.statSync(file).size > 256 * 1024) throw failure(413, 'Document Markdown trop volumineux.');
    const raw = fs.readFileSync(file);
    const { body, yaml } = parse(raw);
    const metadata = yaml.toJSON() || {};
    const heading = body.match(/^#{1,6}\s+(.+?)\s*#*$/m);
    const summary = body.split('\n').find((line) => line.trim() && !/^(#|[-*>`|]|\d+\.)/.test(line));
    return {
      id, sourcePath,
      title: text(metadata.title, heading?.[1] || path.basename(file, path.extname(file)).replace(/[_-]/g, ' ')),
      category: text(metadata.category || metadata.space, categoryFor(sourcePath)),
      summary: text(metadata.summary || metadata.description, summary?.trim().slice(0, 180) || `Document du dépôt : ${sourcePath}`),
      owner: text(metadata.owner || metadata.author, 'Non renseigné'),
      updated: text(metadata.updated || metadata.updated_at || metadata.date),
      status: /^(draft|brouillon)$/i.test(text(metadata.status)) ? 'draft' : 'published',
      body, revision: revision(raw),
    };
  }

  list() { return this.files().map((id) => this.read(id)); }

  checkRevision(file, expected) {
    if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected)) throw failure(400, 'Version du document requise.');
    if (revision(fs.readFileSync(file)) !== expected) throw failure(409, 'Le fichier a changé dans le dépôt. Rechargez la documentation avant de réessayer.');
  }

  publish(id, data, owner) {
    const { file } = this.resolve(id);
    this.checkRevision(file, data.revision);
    const { yaml } = parse(fs.readFileSync(file));
    for (const [key, value] of Object.entries({ title: data.title.trim() || 'Sans titre', summary: data.summary.trim(),
      category: data.category, owner, updated: new Date().toISOString(), status: 'published' })) yaml.set(key, value);
    const content = `---\n${yaml.toString()}---\n${data.body}`;
    const temp = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.tmp`);
    let descriptor;
    try {
      descriptor = fs.openSync(temp, 'wx', fs.statSync(file).mode & 0o777);
      fs.writeFileSync(descriptor, content, 'utf8');
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      descriptor = undefined;
      this.resolve(id);
      this.checkRevision(file, data.revision);
      fs.renameSync(temp, file);
    } finally {
      if (descriptor !== undefined) fs.closeSync(descriptor);
      if (fs.existsSync(temp)) fs.unlinkSync(temp);
    }
    return this.read(id);
  }

  create(owner) {
    const root = this.safeRoot();
    const folder = path.join(root, 'Notes-equipe');
    if (!fs.existsSync(folder)) fs.mkdirSync(folder);
    const stat = fs.lstatSync(folder);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw failure(403, 'Dossier de notes invalide.');
    const sourcePath = `Notes-equipe/note-${randomUUID()}.md`;
    const metadata = YAML.stringify({ title: 'Nouvelle note', summary: 'Brouillon en cours de rédaction.',
      category: 'Notes d’équipe', owner, updated: new Date().toISOString(), status: 'draft' });
    fs.writeFileSync(path.join(root, sourcePath), `---\n${metadata}---\n## Notes\n\nCommencez à rédiger ici.\n`, { encoding: 'utf8', flag: 'wx' });
    return this.read(`docs/${sourcePath}`);
  }

  remove(id, expected) {
    const { file } = this.resolve(id);
    this.checkRevision(file, expected);
    if (this.files().length <= 1) throw failure(409, 'La dernière page de documentation doit être conservée.');
    fs.unlinkSync(file);
  }
}

module.exports = { DocumentationStore };
