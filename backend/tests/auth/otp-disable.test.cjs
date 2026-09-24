const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDisableOtpHandler } = require('../../routes/otp-disable');

const config = { accountUrl: 'https://keycloak.test', public: { realm: 'bank' } };
const group = (type, ids) => ({ type, userCredentialMetadatas: ids.map(id => ({ credential: { id, type } })) });
async function run(responses) {
  const calls = [];
  const handler = createDisableOtpHandler(config, async (url, options) => {
    calls.push({ url, ...options });
    assert.ok(responses.length, 'unexpected request');
    return responses.shift();
  });
  const res = { statusCode: 200, set() { return this; }, status(n) { this.statusCode = n; return this; },
    json(body) { this.body = body; return this; }, end() { return this; } };
  await handler({ get: () => 'Bearer owner-token', body: { userId: 'other-user', credentialId: 'password' } }, res);
  return { res, calls };
}
const json = body => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });

test('deletes every owned OTP, leaves password untouched, verifies deletion', async () => {
  const { res, calls } = await run([
    json([group('password', ['password']), group('otp', ['phone', 'tablet'])]),
    new Response(null, { status: 204 }), new Response(null, { status: 204 }),
    json([group('password', ['password']), group('otp', [])]),
  ]);
  assert.equal(res.statusCode, 204);
  assert.deepEqual(calls.filter(c => c.method === 'DELETE').map(c => c.url), [
    'https://keycloak.test/realms/bank/account/credentials/phone',
    'https://keycloak.test/realms/bank/account/credentials/tablet',
  ]);
  assert.ok(calls.every(c => c.headers.Authorization === 'Bearer owner-token'));
});
test('refusal does not report successful disable', async () => {
  const { res } = await run([json([group('otp', ['phone'])]), new Response(null, { status: 403 })]);
  assert.equal(res.statusCode, 403);
});
test('remaining OTP after deletion does not report success', async () => {
  const { res } = await run([json([group('otp', ['phone'])]), new Response(null, { status: 204 }), json([group('otp', ['new-phone'])])]);
  assert.equal(res.statusCode, 409);
});
test('unexpected credentials response never triggers a deletion', async () => {
  const { res, calls } = await run([json({ unexpected: true })]);
  assert.equal(res.statusCode, 502);
  assert.equal(calls.length, 1);
});
