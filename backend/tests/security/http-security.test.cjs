const assert = require('node:assert/strict');
const { corsOptions, configureHttpSecurity, httpErrorHandler } = require('../../middlewares/http-security.middleware');

const cases = [
  ['production never enables cross-origin access', () => {
    const options = corsOptions({ NODE_ENV: 'production' });
    for (const origin of [undefined, 'https://evil.example', 'http://localhost:4200', 'null']) {
      options.origin(origin, (error, allowed) => { assert.equal(error, null); assert.equal(allowed, false); });
    }
  }],
  ['development only accepts exact local Angular origins', () => {
    const options = corsOptions({ NODE_ENV: 'development' });
    for (const [origin, expected] of [['http://localhost:4200', true], ['http://127.0.0.1:4200', true], ['http://localhost:4200.evil.example', false], ['https://evil.example', false]]) {
      options.origin(origin, (error, allowed) => { assert.equal(error, null); assert.equal(allowed, expected); });
    }
    assert.equal(options.credentials, false);
  }],
  ['all backend responses have security headers and cannot be cached', () => {
    const middleware = []; let disabled;
    configureHttpSecurity({ disable(value) { disabled = value; }, use(fn) { middleware.push(fn); } }, {NODE_ENV: 'production'});
    assert.equal(disabled, 'x-powered-by');
    let headers; let advanced = false;
    middleware[0]({}, {set(value) {headers = value;}}, () => { advanced = true; });
    assert.equal(headers['Cache-Control'], 'no-store');
    assert.equal(headers['X-Content-Type-Options'], 'nosniff');
    assert.equal(headers['X-Frame-Options'], 'DENY');
    assert.equal(headers['Referrer-Policy'], 'no-referrer');
    assert.equal(advanced, true);
  }],
  ['malformed and oversized JSON produce safe client errors', () => {
    for (const [error, expected] of [[{type: 'entity.parse.failed', body: 'private-data'}, 400], [{type: 'entity.too.large'}, 413], [{status: 415}, 415]]) {
      let status; let response;
      httpErrorHandler(error, {}, {status(value) {status = value; return this;}, json(value) {response = value;}}, () => assert.fail('Unexpected next'));
      assert.equal(status, expected);
      assert.equal(JSON.stringify(response).includes('private-data'), false);
    }
  }],
  ['errors after response headers are delegated', () => {
    const error = new Error('private-data'); let delegated;
    httpErrorHandler(error, {}, {headersSent: true}, value => {delegated = value;});
    assert.equal(delegated, error);
  }],
];

function runChecks() { for (const [, check] of cases) check(); return cases.length; }
module.exports = { runChecks };
if (require.main === module) {
  const test = require('node:test');
  for (const [name, check] of cases) test(name, check);
}
