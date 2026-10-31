'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { signJwt, SIGNING_ALGORITHMS } = require('../src/core/jwt');
const { base64urlJSON } = require('../src/core/base64url');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
});

for (const algorithm of Object.keys(SIGNING_ALGORITHMS)) {
  test(`signJwt produces a signature crypto.verify accepts for ${algorithm}`, () => {
    const header = { kid: 'test-key' };
    const payload = { iss: 'test-issuer', iat: 1000, exp: 1300 };

    const jwt = signJwt({ header, payload, privateKey, algorithm });
    const [encodedHeader, encodedPayload, encodedSignature] = jwt.split('.');

    assert.equal(encodedHeader, base64urlJSON({ ...header, typ: 'JWT', alg: algorithm }));
    assert.equal(encodedPayload, base64urlJSON(payload));

    const spec = SIGNING_ALGORITHMS[algorithm];
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const signature = Buffer.from(encodedSignature, 'base64url');

    const verifyOptions = { key: publicKey };
    if (spec.padding !== undefined) verifyOptions.padding = spec.padding;
    if (spec.saltLength !== undefined) verifyOptions.saltLength = spec.saltLength;

    const isValid = crypto.verify(
      spec.digest,
      Buffer.from(signingInput),
      verifyOptions,
      signature
    );
    assert.equal(isValid, true);
  });
}

test('signJwt rejects an unsupported algorithm', () => {
  assert.throws(
    () => signJwt({ header: {}, payload: {}, privateKey, algorithm: 'HS256' }),
    /Unsupported JWT signing algorithm: HS256/
  );
});
