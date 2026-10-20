// Disposable local Keycloak; no NAS connection, real credentials or persisted tokens.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const image = process.argv[2] || 'quay.io/keycloak/keycloak:26.7.4';
const name = `suivi-keycloak-test-${Date.now()}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'suivi-kc-test-'));
const password = crypto.randomBytes(24).toString('base64url');
const client = 'suivi-cb-web', realm = 'security-test';
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120000 }).trim();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const decodeHtml = s => s.replaceAll('&amp;', '&').replaceAll('&#39;', "'").replaceAll('&quot;', '"');
const action = html => {
 const tag = html.match(/<form\b[^>]*\baction="([^"]+)"/);
 assert.ok(tag, 'Expected a Keycloak form');
 return decodeHtml(tag[1]);
};
function totp(secret) {
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
 let bits=''; for(const c of secret.replace(/[\s=]/g,'').toUpperCase()) bits+=alphabet.indexOf(c).toString(2).padStart(5,'0');
 const key=Buffer.from((bits.match(/.{8}/g)||[]).map(s=>parseInt(s,2)));
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
 const hash=crypto.createHmac('sha1',key).update(counter).digest(), offset=hash[19]&15;
 return String((hash.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
}
fs.writeFileSync(path.join(dir,'realm.json'),JSON.stringify({
 realm,enabled:true,sslRequired:'none',loginTheme:'keycloak',
 otpPolicyType:'totp',otpPolicyAlgorithm:'HmacSHA1',otpPolicyDigits:6,otpPolicyPeriod:30,otpPolicyCodeReusable:false,
 roles:{realm:[{name:'app-user'}]},
 clients:[{clientId:client,enabled:true,publicClient:true,standardFlowEnabled:true,directAccessGrantsEnabled:false,
  redirectUris:['http://127.0.0.1/callback'],webOrigins:['http://127.0.0.1'],
  attributes:{'pkce.code.challenge.method':'S256'},
  protocolMappers:['suivi-cb-api','account'].map(a=>({name:`aud-${a}`,protocol:'openid-connect',protocolMapper:'oidc-audience-mapper',
   config:{'included.custom.audience':a,'access.token.claim':'true','id.token.claim':'false'}}))}],
 users:[{username:'fixture',enabled:true,emailVerified:true,email:'fixture@example.invalid',firstName:'Synthetic',lastName:'Test',
  realmRoles:['app-user'],requiredActions:['CONFIGURE_TOTP'],credentials:[{type:'password',value:password,temporary:false}]}],
}),{mode:0o600});
(async()=>{
 try {
  docker('create','--entrypoint','sh','--pull=never','--name',name,'--memory','768m','-p','127.0.0.1::8080',
   '-e','JAVA_OPTS_KC_HEAP=-Xms128m -Xmx384m',image,'-c','mkdir -p /opt/keycloak/data/import && cp /tmp/realm.json /opt/keycloak/data/import/realm.json && exec /opt/keycloak/bin/kc.sh start-dev --import-realm');
  fs.chmodSync(path.join(dir,'realm.json'),0o644);
  docker('cp',path.join(dir,'realm.json'),name+':/tmp/realm.json');
  docker('start',name);
  const mapped=docker('port',name,'8080/tcp');
  const base=`http://${mapped}`, issuer=`${base}/realms/${realm}`;
  let ready=false;
  for(let i=0;i<150;i++) {
   try { if((await fetch(`${issuer}/.well-known/openid-configuration`,{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;} }catch{}
   await pause(1000);
  }
  assert.ok(ready,'Keycloak readiness timed out');
  let jar=new Map();
  async function request(url,form) {
   const res=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(10000),
    method:form?'POST':'GET',headers:{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; '),...(form?{'Content-Type':'application/x-www-form-urlencoded'}:{})},
    body:form?new URLSearchParams(form):undefined});
   for(const cookie of res.headers.getSetCookie()) { const [key,...value]=cookie.split(';')[0].split('=');jar.set(key,value.join('=')); }
   return {status:res.status,location:res.headers.get('location'),html:await res.text()};
  }
  const oidc=`${issuer}/protocol/openid-connect`;
  const verifier=crypto.randomBytes(48).toString('base64url');
  const challenge=crypto.createHash('sha256').update(verifier).digest('base64url');
  const auth=()=>`${oidc}/auth?${new URLSearchParams({client_id:client,redirect_uri:'http://127.0.0.1/callback',response_type:'code',scope:'openid',code_challenge:challenge,code_challenge_method:'S256',state:crypto.randomBytes(16).toString('hex')})}`;
  let response=await request(auth());
  response=await request(action(response.html),{username:'fixture',password});
  // Required action redirects remain inside our disposable Keycloak.
  while(response.status===302 && response.location?.startsWith(base)) response=await request(response.location);
  const manual=response.html.match(/href="([^"]+)"[^>]*id="mode-manual"/);
  assert.ok(manual,'OTP enrollment required');
  response=await request(decodeHtml(manual[1]));
  const secret=response.html.match(/id="kc-totp-secret-key">([^<]+)</)?.[1];
  const rawSecret=response.html.match(/name="totpSecret" value="([^"]+)"/)?.[1];
  assert.ok(secret && rawSecret,'OTP enrollment secrets available only in memory');
  const usedStep=Math.floor(Date.now()/30000);
  response=await request(action(response.html),{totp:totp(secret),totpSecret:rawSecret,userLabel:'Synthetic test',mode:'manual'});
  while(response.status===302 && response.location?.startsWith(base)) response=await request(response.location);
  assert.equal(response.status,302,'Enrollment ends in authorization code');
  const code=new URL(response.location).searchParams.get('code');assert.ok(code);
  async function token(form,expected=200) {
   const res=await fetch(`${oidc}/token`,{method:'POST',body:new URLSearchParams({client_id:client,...form}),signal:AbortSignal.timeout(10000)});
   const result=await res.json();assert.equal(res.status,expected,`Token endpoint: ${result.error||res.status}`);return result;
  }
  const initial=await token({grant_type:'authorization_code',code,redirect_uri:'http://127.0.0.1/callback',code_verifier:verifier});
  const claims=JSON.parse(Buffer.from(initial.access_token.split('.')[1],'base64url'));
  assert.ok(Array.isArray(claims.aud));
  assert.ok(claims.aud.includes('suivi-cb-api') && claims.aud.includes('account'));
  assert.ok(claims.realm_access.roles.includes('app-user'));
  const renewed=await token({grant_type:'refresh_token',refresh_token:initial.refresh_token});assert.ok(renewed.access_token);
  const logout=await fetch(`${oidc}/logout`,{method:'POST',body:new URLSearchParams({client_id:client,refresh_token:renewed.refresh_token}),signal:AbortSignal.timeout(10000)});
  assert.equal(logout.status,204);
  assert.equal((await token({grant_type:'refresh_token',refresh_token:renewed.refresh_token},400)).error,'invalid_grant');
  jar=new Map();response=await request(auth());response=await request(action(response.html),{username:'fixture',password});
  while(response.status===302 && response.location?.startsWith(base)) response=await request(response.location);
  assert.match(response.html,/kc-otp-login-form/,'Second login requires OTP');
  response=await request(action(response.html),{otp:'not-a-code',login:'Log in'});
  assert.equal(response.status,200);assert.match(response.html,/kc-otp-login-form/);
  // Avoid replaying the code used during enrollment.
  while(Math.floor(Date.now()/30000)<=usedStep) await pause(1000);
  response=await request(action(response.html),{otp:totp(secret),login:'Log in'});
  while(response.status===302 && response.location?.startsWith(base)) response=await request(response.location);
  assert.equal(response.status,302);assert.ok(new URL(response.location).searchParams.get('code'));
  console.log(JSON.stringify({status:'PASS',image:docker('image','inspect','--format','{{.Id}}',image),
   checks:['authorization code with PKCE S256','OTP enrollment','real access-token audiences account + suivi-cb-api','refresh','logout invalidates refresh token','OTP required on next login','invalid OTP refused','valid OTP accepted'],
   limitations:['synthetic realm and user','NAS realm configuration and Angular browser journey still require preproduction acceptance']},null,2));
 } finally {
  try{docker('rm','-f',name)}catch{process.exitCode=1;console.error('KEYCLOAK_CLEANUP_FAILED')}
  if(path.dirname(path.resolve(dir))===path.resolve(os.tmpdir()) && path.basename(dir).startsWith('suivi-kc-test-')) fs.rmSync(dir,{recursive:true,force:true});
  else { process.exitCode=1;console.error('UNEXPECTED_TEMPORARY_DIRECTORY'); }
 }
})().catch(e=>{console.error(e.message);process.exitCode=1});
