const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const path = require('node:path');

test('the actual server protects banking and OTP routes with their respective audiences', { timeout: 20000 }, async t => {
  const { generateKeyPair, exportJWK, SignJWT } = await import('jose');
  const pair = await generateKeyPair('RS256');
  const jwk = { ...await exportJWK(pair.publicKey), kid: 'integration-key', alg: 'RS256', use: 'sig' };
  // Synthetic issuer only: no connection to a real realm or banking database.
  const issuerServer = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url.endsWith('/protocol/openid-connect/certs')) res.end(JSON.stringify({ keys: [jwk] }));
    else if (req.url.includes('/account/credentials')) res.end('[]');
    else { res.statusCode = 404; res.end('{}'); }
  });
  issuerServer.listen(0, '127.0.0.1');
  await once(issuerServer, 'listening');
  t.after(() => new Promise(resolve => issuerServer.close(resolve)));
  const keycloakUrl = `http://127.0.0.1:${issuerServer.address().port}`;
  const reserve = http.createServer();
  reserve.listen(0, '127.0.0.1');
  await once(reserve, 'listening');
  const port = reserve.address().port;
  await new Promise(resolve => reserve.close(resolve));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '../..'),
    env: { ...process.env, NODE_ENV: 'test', DB_PATH: ':memory:', PORT_BACK: String(port),
      KEYCLOAK_URL: keycloakUrl, KEYCLOAK_ACCOUNT_URL: keycloakUrl,
      KEYCLOAK_REALM: 'integration', KEYCLOAK_CLIENT_ID: 'integration-web',
      KEYCLOAK_AUDIENCE: 'suivi-cb-api',
      KEYCLOAK_JWKS_URL: `${keycloakUrl}/realms/integration/protocol/openid-connect/certs`,
      DOCUMENTATION_DISABLED: 'true' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', b => { logs = (logs + b).slice(-6000); });
  child.stderr.on('data', b => { logs = (logs + b).slice(-6000); });
  let spawnError;
  child.on('error', e => { spawnError = e; });
  t.after(async () => { if (child.exitCode === null && !spawnError) { const exit = once(child, 'exit'); child.kill(); await exit; } });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) throw new Error(`Server exited: ${logs}`);
    try { if ((await fetch(`${base}/health`, { signal: AbortSignal.timeout(500) })).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.ok(ready, `Server did not become healthy: ${logs}`);
  const token = (claims = {}, key = pair.privateKey) => new SignJWT({
    sub: 'synthetic-user', typ: 'Bearer', azp: 'integration-web',
    iss: `${keycloakUrl}/realms/integration`, aud: 'suivi-cb-api',
    realm_access: { roles: ['app-user'] }, iat: Math.floor(Date.now()/1000),
    exp: Math.floor(Date.now()/1000) + 60, ...claims,
  }).setProtectedHeader({ alg: 'RS256', kid: 'integration-key' }).sign(key);
  const status = async (route, bearer) => (await fetch(`${base}${route}`, {
    headers: bearer ? { Authorization: `Bearer ${bearer}` } : {}, signal: AbortSignal.timeout(2000),
  })).status;
  assert.equal(await status('/api/auth/config'), 200);
  for (const route of ['/api/accounts/active', '/api/transactions', '/api/categories', '/api/salaries', '/api/auth/otp-credentials']) {
    assert.equal(await status(route), 401, route);
  }
  for (const claims of [{ exp: 1 }, { aud: 'account' }, { iss: `${keycloakUrl}/realms/other` }]) {
    assert.equal(await status('/api/accounts/active', await token(claims)), 401);
  }
  const other = await generateKeyPair('RS256');
  assert.equal(await status('/api/accounts/active', await token({}, other.privateKey)), 401);
  assert.equal(await status('/api/accounts/active', await token({ realm_access: { roles: [] } })), 403);
  assert.equal(await status('/api/accounts/active', await token()), 200);
  assert.equal(await status('/api/auth/otp-credentials', await token()), 401);
  assert.equal(await status('/api/auth/otp-credentials', await token({ aud: 'account' })), 200);
});
