'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createTokenClient } = require('../src/core/tokenClient');

const BASE_OPTIONS = {
  tokenUrl: 'https://auth.example.com/oauth2/token',
  algorithm: 'RS256',
  issuer: 'test-issuer',
};

function jsonResponse(status, body) {
  const text = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
  };
}

function textResponse(status, text) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
  };
}

// getAccessToken() always signs a real JWT internally (tested separately in
// jwt.test.js), so a real key is needed here too even though these tests
// only care about caching/request behavior via the injectable `fetch`/`now`.
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });

function makeClient(overrides = {}) {
  return createTokenClient({ ...BASE_OPTIONS, privateKey, ...overrides });
}

test('caches the token and does not re-fetch before expiry - skew', async () => {
  let calls = 0;
  let nowMs = 0;
  const fetchImpl = async () => {
    calls += 1;
    return jsonResponse(200, { access_token: 'token-1', expires_in: 3600 });
  };

  const client = makeClient({ fetch: fetchImpl, now: () => nowMs, clockSkewSeconds: 60 });

  assert.equal(await client.getAccessToken(), 'token-1');
  nowMs += 1000; // well within the cache window
  assert.equal(await client.getAccessToken(), 'token-1');
  assert.equal(calls, 1);
});

test('refreshes once inside the clock-skew window before actual expiry', async () => {
  let calls = 0;
  let nowMs = 0;
  const fetchImpl = async () => {
    calls += 1;
    return jsonResponse(200, { access_token: `token-${calls}`, expires_in: 3600 });
  };

  const client = makeClient({ fetch: fetchImpl, now: () => nowMs, clockSkewSeconds: 60 });

  assert.equal(await client.getAccessToken(), 'token-1');
  // 3600s expiry - 60s skew = refresh due at 3540s; land just past it.
  nowMs = 3541 * 1000;
  assert.equal(await client.getAccessToken(), 'token-2');
  assert.equal(calls, 2);
});

test('concurrent calls while a refresh is in flight share one request', async () => {
  let calls = 0;
  let resolveFetch;
  const fetchImpl = () => {
    calls += 1;
    return new Promise((resolve) => {
      resolveFetch = () => resolve(jsonResponse(200, { access_token: 'shared-token', expires_in: 3600 }));
    });
  };

  const client = makeClient({ fetch: fetchImpl, now: () => 0 });

  const p1 = client.getAccessToken();
  const p2 = client.getAccessToken();
  const p3 = client.getAccessToken();

  assert.equal(calls, 1);
  resolveFetch();

  const [t1, t2, t3] = await Promise.all([p1, p2, p3]);
  assert.equal(t1, 'shared-token');
  assert.equal(t2, 'shared-token');
  assert.equal(t3, 'shared-token');
  assert.equal(calls, 1);
});

test('a failed request clears the in-flight state so the next call retries', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) {
      return textResponse(500, 'internal error');
    }
    return jsonResponse(200, { access_token: 'recovered-token', expires_in: 3600 });
  };

  const client = makeClient({ fetch: fetchImpl, now: () => 0 });

  await assert.rejects(() => client.getAccessToken(), /Token request failed \(HTTP 500\)/);
  assert.equal(await client.getAccessToken(), 'recovered-token');
  assert.equal(calls, 2);
});

test('summarizes a non-OK JSON error body in the thrown error', async () => {
  const fetchImpl = async () =>
    jsonResponse(400, { error: 'invalid_request', error_description: 'missing scope' });
  const client = makeClient({ fetch: fetchImpl, now: () => 0 });

  await assert.rejects(() => client.getAccessToken(), /missing scope/);
});

test('summarizes a non-OK HTML error body in the thrown error', async () => {
  const fetchImpl = async () =>
    textResponse(502, '<html><head><title>Bad Gateway</title></head></html>');
  const client = makeClient({ fetch: fetchImpl, now: () => 0 });

  await assert.rejects(() => client.getAccessToken(), /Bad Gateway/);
});

test('summarizes a non-OK plain-text error body, truncated', async () => {
  const fetchImpl = async () => textResponse(503, 'x'.repeat(250));
  const client = makeClient({ fetch: fetchImpl, now: () => 0 });

  await assert.rejects(() => client.getAccessToken(), new RegExp(`${'x'.repeat(200)}\\.\\.\\.`));
});

test('throws when the response has no access_token', async () => {
  const fetchImpl = async () => jsonResponse(200, { token_type: 'Bearer' });
  const client = makeClient({ fetch: fetchImpl, now: () => 0 });

  await assert.rejects(() => client.getAccessToken(), /did not include an access_token/);
});

test('accepts expires_in as a JSON number', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return jsonResponse(200, { access_token: 'num-token', expires_in: 3600 });
  };
  const client = makeClient({ fetch: fetchImpl, now: () => 0, clockSkewSeconds: 60 });

  await client.getAccessToken();
  await client.getAccessToken();
  assert.equal(calls, 1);
});

test('accepts expires_in as a numeric string', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return jsonResponse(200, { access_token: 'str-token', expires_in: '3600' });
  };
  const client = makeClient({ fetch: fetchImpl, now: () => 0, clockSkewSeconds: 60 });

  await client.getAccessToken();
  await client.getAccessToken();
  assert.equal(calls, 1);
});

test('treats a non-numeric expires_in as already expired (0s)', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return jsonResponse(200, { access_token: `bad-expiry-${calls}`, expires_in: 'not-a-number' });
  };
  const client = makeClient({ fetch: fetchImpl, now: () => 0, clockSkewSeconds: 60 });

  await client.getAccessToken();
  await client.getAccessToken();
  assert.equal(calls, 2);
});

test('clearCache() forces the next call to re-fetch', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return jsonResponse(200, { access_token: `token-${calls}`, expires_in: 3600 });
  };
  const client = makeClient({ fetch: fetchImpl, now: () => 0 });

  assert.equal(await client.getAccessToken(), 'token-1');
  client.clearCache();
  assert.equal(await client.getAccessToken(), 'token-2');
  assert.equal(calls, 2);
});
