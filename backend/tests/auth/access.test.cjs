const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { authConfig } = require('../../config/auth');
const { createAuthMiddleware } = require('../../middlewares/auth.middleware');

let jose, pair, middleware;
const config = authConfig({});
test('account API preserves the issuer hostname unless explicitly overridden', () => {
  assert.equal(config.accountUrl, config.public.url);
  assert.equal(config.accountUrl, 'http://localhost:8080');
  const internal = authConfig({ KEYCLOAK_ACCOUNT_URL: 'http://keycloak:8080/' });
  assert.equal(internal.accountUrl, 'http://keycloak:8080');
  assert.equal(internal.issuer, config.issuer);
});
before(async () => {
  jose = await import('jose');
  pair = await jose.generateKeyPair('RS256');
  middleware = await createAuthMiddleware(config, pair.publicKey);
});

async function token(overrides = {}, key) {
  return new jose.SignJWT({
    sub: 'test-user', typ: 'Bearer', azp: config.public.clientId,
    realm_access: { roles: ['app-user'] },
    iss: config.issuer, aud: config.audience,
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 60,
    ...overrides,
  }).setProtectedHeader({ alg: 'RS256' }).sign(key || pair.privateKey);
}

async function request(bearer) {
  const app = express();
  app.use('/api', middleware);
  app.get('/api/accounts', (req, res) => res.json({ user: req.auth.sub }));
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/accounts`, {
      headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
    });
    return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('configuration production fermée sans URL HTTPS', () => {
  assert.throws(() => authConfig({ NODE_ENV: 'production' }), /obligatoire/);
  assert.throws(() => authConfig({ NODE_ENV: 'production', KEYCLOAK_URL: 'http://example.com' }), /HTTPS/);
});
test('API inaccessible sans jeton ou avec un jeton malformé', async () => {
  assert.equal((await request()).status, 401);
  assert.equal((await request('invalid')).status, 401);
});
test('jeton signé, rôle et audience corrects donnent accès', async () => {
  const result = await request(await token());
  assert.equal(result.status, 200);
  assert.equal(result.body.user, 'test-user');
  assert.equal(result.cache, 'no-store');
});
test('jeton expiré, mauvais issuer/audience/client/type sont refusés', async () => {
  for (const claims of [
    { exp: 1 }, { iss: 'https://attacker.invalid' }, { aud: 'other-api' },
    { azp: 'other-client' }, { typ: 'ID' }, { exp: undefined }, { sub: undefined },
  ]) assert.equal((await request(await token(claims))).status, 401);
});
test('une autre signature est refusée', async () => {
  const other = await jose.generateKeyPair('RS256');
  assert.equal((await request(await token({}, other.privateKey))).status, 401);
});
test('utilisateur authentifié sans rôle interdit', async () => {
  assert.equal((await request(await token({ realm_access: { roles: [] } }))).status, 403);
});
