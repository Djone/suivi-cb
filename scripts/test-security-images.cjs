// Local, synthetic exercise only. Never accepts a host data directory.
const { execFileSync, spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const [backend, frontend, previous] = process.argv.slice(2);
if (!backend || !frontend || !previous) throw new Error('Usage: node scripts/test-security-images.cjs BACKEND FRONTEND PREVIOUS_BACKEND');
const suffix = `${Date.now()}-${process.pid}`;
const network = `suivi-security-${suffix}`;
const volume = `${network}-data`;
const containers = [];
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const node = (container, code) => docker('exec', container, 'node', '-e', code);
const wait = async (name, port, route = '/health') => {
  for (let i=0;i<100;i++) {
    try { return node(name, `fetch('http://127.0.0.1:${port}${route}').then(r=>{if(!r.ok)process.exit(1)})`); } catch {}
    if (docker('inspect','--format','{{.State.Running}}',name) !== 'true') break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const logs = spawnSync('docker',['logs',name],{encoding:'utf8'});
  throw new Error(`Container did not become ready: ${logs.stdout}\n${logs.stderr}`);
};
const start = (image, label, extra=[]) => {
  const name = `${network}-${label}`;
  containers.push(name);
  docker('run','-d','--pull=never','--name',name,'--network',network,'--cap-drop','ALL',
    '--security-opt','no-new-privileges','--memory','256m', ...extra, image);
  return name;
};
const data = ['--mount',`type=volume,source=${volume},target=/app/data`,'-e','DB_PATH=/app/data/database.db','-e','KEYCLOAK_URL=https://synthetic.invalid'];
const marker = `rollback-proof-${suffix}`;
(async()=>{
 try {
  docker('network','create','--internal',network);
  docker('volume','create',volume);
  // Provision only our new disposable volume; application processes stay non-root.
  docker('run','--rm','--network','none','--user','0','--mount',`type=volume,source=${volume},target=/app/data`, '--entrypoint','sh',backend,'-c','chown 1028:100 /app/data && touch /app/data/.synthetic-test-volume');
  // Seed with the previous application, then migrate the same database.
  const old = start(previous,'previous',['--user','1028:100',...data]);
  await wait(old,3001,'/api/accounts/active');
  docker('stop',old);
  const current = start(backend,'current',['--network-alias','backend',...data]);
  await wait(current,3001);
  assert.equal(node(current,'console.log(process.getuid())'),'1028');
  assert.equal(node(current,"fetch('http://127.0.0.1:3001/api/accounts/active').then(r=>console.log(r.status))"),'401');
  // This write happens after the upgrade, and must survive the rollback.
  node(current,`const d=require('./config/db');d.run('INSERT INTO accounts(name,is_active) VALUES (?,1)',[${JSON.stringify(marker)}],e=>{if(e)throw e;d.close()});`);
  const web = start(frontend,'web');
  for(let i=0;i<100;i++){
   try { docker('exec',web,'wget','-q','-O','/dev/null','http://127.0.0.1/'); break; }
   catch(e){ if(i===99)throw e;await new Promise(r=>setTimeout(r,100)); }
  }
  assert.match(docker('exec',web,'id'),/uid=101/);
  assert.equal(node(current,`fetch('http://${web}/api/accounts/active').then(r=>console.log(r.status))`),'401');
  docker('stop',web);
  docker('stop',current);
  docker('start',old);
  await wait(old,3001,'/api/accounts/active');
  const read = name => node(name,`const d=require('./config/db');d.get('SELECT count(*) n FROM accounts WHERE name=?',[${JSON.stringify(marker)}],(e,r)=>{if(e)throw e;console.log(r.n);d.close()});`);
  assert.match(read(old),/\b1\s*$/);
  docker('stop',old);
  docker('start',current);
  await wait(current,3001);
  assert.match(read(current),/\b1\s*$/);
  console.log(JSON.stringify({status:'PASS',backend:docker('image','inspect','--format','{{.Id}}',backend),
   frontend:docker('image','inspect','--format','{{.Id}}',frontend), previous:docker('image','inspect','--format','{{.Id}}',previous),
   checks:['previous database upgrade','non-root startup with all capabilities dropped','anonymous API 401','frontend default command HTTP 200','frontend API proxy 401','rollback preserves post-upgrade write','upgrade after rollback'],
   limitations:['synthetic data only','no real Keycloak login','not a release approval']},null,2));
 } finally {
  for(const name of containers.reverse())try{docker('rm','-f',name)}catch{}
  try{docker('volume','rm',volume)}catch{}
  try{docker('network','rm',network)}catch{}
 }
})().catch(e=>{console.error(e.stderr?.toString() || e.stack);process.exitCode=1});
