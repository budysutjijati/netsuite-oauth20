'use strict';

const crypto = require('crypto');
const { base64url, base64urlJSON } = require('./base64url');

// RSA-family algorithms only. JWT-bearer client assertions for OAuth 2.0
// Client Credentials grants are overwhelmingly RSA-signed in practice (RS*
// and PS*/RSASSA-PSS); this core module stays generic across any issuer
// that expects one of these, without guessing at provider-specific needs
// beyond that.
const SIGNING_ALGORITHMS = {
  RS256: { digest: 'sha256' },
  RS384: { digest: 'sha384' },
  RS512: { digest: 'sha512' },
  PS256: {
    digest: 'sha256',
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
  },
  PS384: {
    digest: 'sha384',
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
  },
  PS512: {
    digest: 'sha512',
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
  },
};

/**
 * Builds and signs a compact JWT. Carries no opinion about which claims
 * belong in the payload or header beyond `typ`/`alg` - callers (or an
 * adapter layer) decide everything else, including `kid`.
 */
function signJwt({ header, payload, privateKey, algorithm }) {
  const spec = SIGNING_ALGORITHMS[algorithm];
  if (!spec) {
    throw new Error(
      `Unsupported JWT signing algorithm: ${algorithm}. Supported: ${Object.keys(SIGNING_ALGORITHMS).join(', ')}`
    );
  }

  const fullHeader = { ...header, typ: 'JWT', alg: algorithm };
  const signingInput = `${base64urlJSON(fullHeader)}.${base64urlJSON(payload)}`;

  const signOptions = { key: privateKey };
  if (spec.padding !== undefined) signOptions.padding = spec.padding;
  if (spec.saltLength !== undefined) signOptions.saltLength = spec.saltLength;

  const signature = crypto.sign(spec.digest, Buffer.from(signingInput), signOptions);

  return `${signingInput}.${base64url(signature)}`;
}

module.exports = { signJwt, SIGNING_ALGORITHMS };
