import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Parser } from '../backend/node_modules/tar/dist/esm/index.min.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = b => createHash('sha256').update(b).digest('hex');
function entries(buffer, filter = () => true) {
  return new Promise((resolve, reject) => {
    const files = new Map();
    const parser = new Parser({ onReadEntry(entry) {
      if (!filter(entry.path) || entry.type !== 'File') { entry.resume(); return; }
      const chunks=[]; entry.on('data', b=>chunks.push(b));
      entry.on('end', ()=>files.set(entry.path.replace(/^\.\//,''), Buffer.concat(chunks)));
    }});
    parser.on('error', reject); parser.on('end', ()=>resolve(files)); parser.end(buffer);
  });
}
const archive = path.resolve(process.argv[2]);
const raw = await fs.readFile(archive);
const outer = await entries(raw);
const manifest = JSON.parse(outer.get('manifest.json'));
const report = {archive:path.basename(archive), archiveSha256:hash(raw), scope:'All archive layers; names and hashes only, no data values', images:[]};
for (const image of manifest) {
  const config=JSON.parse(outer.get(image.Config));
  const result={tags:image.RepoTags, configDigest:'sha256:'+hash(outer.get(image.Config)), user:config.config.User || 'root (default)', sensitivePaths:[], sourceDifferences:[], packages:{}, nginx:{}};
  for (const layer of image.Layers) {
    const files=await entries(outer.get(layer), name=>name.startsWith('app/') || name.startsWith('./app/') || name.includes('etc/nginx/nginx.conf'));
    for (const [name,content] of files) {
      if(name.startsWith('app/') && !name.includes('/node_modules/')) {
        if(/(^|\/)(\.env(?:\..*)?|.*\.(?:db|sqlite|sqlite3|csv)|id_rsa|id_ed25519)$/.test(name)) result.sensitivePaths.push(name);
        const rel=name.slice(4); const local=path.resolve(root,'backend',rel);
        if(local.startsWith(path.resolve(root,'backend')+path.sep) && /\.(js|json)$/.test(name)) {
          try { if(hash(content)!==hash(await fs.readFile(local))) result.sourceDifferences.push(name); } catch {}
        }
      }
      if(name==='app/package-lock.json') {
        const lock=JSON.parse(content); result.packages=Object.fromEntries(Object.entries(lock.packages).filter(([k])=>['node_modules/express','node_modules/jose','node_modules/sqlite3','node_modules/joi'].includes(k)).map(([k,v])=>[k,v.version]));
      }
      if(name==='etc/nginx/nginx.conf') result.nginx={matchesWorkspace:hash(content)===hash(await fs.readFile(path.join(root,'nginx.conf'))), silentSsoException:/location\s*=\s*\/silent-check-sso.html/.test(content.toString()), globalCspReportOnly:content.includes('Content-Security-Policy-Report-Only')};
    }
  }
  report.images.push(result);
}
await fs.writeFile(process.argv[3],JSON.stringify(report,null,2)+'\n'); console.log(JSON.stringify(report,null,2));
