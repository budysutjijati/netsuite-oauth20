'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  domainFor,
  tokenUrlFor,
  suiteQlUrlFor,
  createNetSuiteTokenClient,
} = require('../src/adapters/netsuite');

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });

function decodeSegment(segment) {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
}

test('domainFor converts account IDs to the lowercase, hyphenated domain form', () => {
  assert.equal(domainFor('1234567_SB1'), '1234567-sb1');
  assert.equal(domainFor('1234567'), '1234567');
});

test('domainFor rejects a missing or non-string accountId', () => {
  assert.throws(() => domainFor(''), /accountId must be a non-empty string/);
  assert.throws(() => domainFor(undefined), /accountId must be a non-empty string/);
});

test('tokenUrlFor and suiteQlUrlFor build account-specific URLs', () => {
  assert.equal(
    tokenUrlFor('1234567_SB1'),
    'https://1234567-sb1.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token'
  );
  assert.equal(
    suiteQlUrlFor('1234567_SB1'),
    'https://1234567-sb1.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql'
  );
});

test('rejects jwtLifetimeSeconds greater than 3600', () => {
  assert.throws(
    () =>
      createNetSuiteTokenClient({
        accountId: '1234567_SB1',
        clientId: 'client-id',
        certificateId: 'cert-id',
        privateKey,
        jwtLifetimeSeconds: 3601,
      }),
    /jwtLifetimeSeconds \(3601\) exceeds NetSuite's maximum of 3600s/
  );
});

test('builds a PS256 assertion with kid, iss, scope as an array, and no aud', async () => {
  let capturedAssertion;
  const fetchImpl = async (url, init) => {
    const params = new URLSearchParams(init.body);
    capturedAssertion = params.get('client_assertion');
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ access_token: 'token', expires_in: 3600 }),
    };
  };

  const client = createNetSuiteTokenClient({
    accountId: '1234567_SB1',
    clientId: 'my-client-id',
    certificateId: 'my-cert-id',
    privateKey,
    fetch: fetchImpl,
  });

  await client.getAccessToken();

  const [encodedHeader, encodedPayload] = capturedAssertion.split('.');
  const header = decodeSegment(encodedHeader);
  const payload = decodeSegment(encodedPayload);

  assert.equal(header.alg, 'PS256');
  assert.equal(header.kid, 'my-cert-id');
  assert.equal(payload.iss, 'my-client-id');
  assert.deepEqual(payload.scope, ['rest_webservices']);
  assert.equal('aud' in payload, false);
  assert.equal(payload.exp - payload.iat, 300);
});

test('accepts a single scope string and wraps it in an array', async () => {
  let capturedAssertion;
  const fetchImpl = async (url, init) => {
    const params = new URLSearchParams(init.body);
    capturedAssertion = params.get('client_assertion');
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ access_token: 'token', expires_in: 3600 }),
    };
  };

  const client = createNetSuiteTokenClient({
    accountId: '1234567_SB1',
    clientId: 'my-client-id',
    certificateId: 'my-cert-id',
    privateKey,
    scope: 'restlets',
    fetch: fetchImpl,
  });

  await client.getAccessToken();

  const [, encodedPayload] = capturedAssertion.split('.');
  assert.deepEqual(decodeSegment(encodedPayload).scope, ['restlets']);
});
