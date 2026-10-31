'use strict';

const { signJwt } = require('./jwt');
const { summarizeErrorBody } = require('./errors');

const DEFAULT_CLOCK_SKEW_SECONDS = 60;
const DEFAULT_JWT_LIFETIME_SECONDS = 300;
const JWT_BEARER_CLIENT_ASSERTION_TYPE =
  'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';

/**
 * Generic OAuth 2.0 Client Credentials grant via a JWT-bearer client
 * assertion (RFC 7523 §2.2). Has zero knowledge of any specific
 * authorization server - no default `aud`/`sub` claims are ever added;
 * callers opt in via `subject`/`audience`/`extraClaims`, or take full
 * control of the payload via `buildClaims`.
 *
 * Returns a client exposing `getAccessToken()`, which caches the token in
 * memory and only refreshes within `clockSkewSeconds` of actual expiry.
 * Concurrent callers mid-refresh share a single in-flight request.
 */
function createTokenClient(options) {
  const {
    tokenUrl,
    algorithm,
    privateKey,
    issuer,
    header,
    subject,
    audience,
    extraClaims,
    buildClaims,
    scope,
    jwtLifetimeSeconds = DEFAULT_JWT_LIFETIME_SECONDS,
    clockSkewSeconds = DEFAULT_CLOCK_SKEW_SECONDS,
    fetch: fetchImpl = globalThis.fetch,
    now = () => Date.now(),
  } = options || {};

  if (!tokenUrl) throw new Error('tokenUrl is required');
  if (!algorithm) throw new Error('algorithm is required');
  if (!privateKey) throw new Error('privateKey is required');
  if (!issuer && !buildClaims) {
    throw new Error('issuer is required unless buildClaims is provided');
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error(
      'A fetch implementation is required (global fetch was not found; pass { fetch } explicitly)'
    );
  }

  let cached = null; // { accessToken, tokenType, expiresAtMs }
  let inFlight = null;

  function buildAssertionClaims() {
    const nowSeconds = Math.floor(now() / 1000);

    if (buildClaims) {
      return buildClaims({ issuer, nowSeconds });
    }

    const claims = {
      iss: issuer,
      iat: nowSeconds,
      exp: nowSeconds + jwtLifetimeSeconds,
    };

    if (subject !== undefined) claims.sub = subject;
    if (audience !== undefined) claims.aud = audience;
    if (extraClaims) Object.assign(claims, extraClaims);

    return claims;
  }

  async function requestToken() {
    const claims = buildAssertionClaims();
    const assertion = signJwt({ header, payload: claims, privateKey, algorithm });

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_assertion_type: JWT_BEARER_CLIENT_ASSERTION_TYPE,
      client_assertion: assertion,
    });
    if (scope) body.set('scope', scope);

    const response = await fetchImpl(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!response.ok) {
      throw new Error(
        `Token request failed (HTTP ${response.status}): ${summarizeErrorBody(json, text)}`
      );
    }
    if (!json || !json.access_token) {
      throw new Error('Token response did not include an access_token');
    }

    // Coerced rather than required to be `typeof === 'number'`: confirmed
    // against a real NetSuite account that it sends a JSON number, but some
    // OAuth servers send `expires_in` as a numeric string, and the core has
    // no business assuming NetSuite's shape.
    const parsedExpiresIn = Number(json.expires_in);
    const expiresInSeconds =
      Number.isFinite(parsedExpiresIn) && parsedExpiresIn > 0 ? parsedExpiresIn : 0;
    cached = {
      accessToken: json.access_token,
      tokenType: json.token_type || 'Bearer',
      expiresAtMs: now() + expiresInSeconds * 1000,
    };
    return cached;
  }

  async function getAccessToken() {
    if (cached && cached.expiresAtMs - clockSkewSeconds * 1000 > now()) {
      return cached.accessToken;
    }
    if (!inFlight) {
      inFlight = requestToken().finally(() => {
        inFlight = null;
      });
    }
    const token = await inFlight;
    return token.accessToken;
  }

  function clearCache() {
    cached = null;
  }

  return { getAccessToken, clearCache };
}

module.exports = { createTokenClient };
