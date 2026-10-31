'use strict';

const { createTokenClient } = require('../../core/tokenClient');

// Proven against a real NetSuite account - see README "Proven NetSuite
// quirks" and do not deviate from these without a concrete reason.
const NETSUITE_JWT_ALGORITHM = 'PS256'; // NetSuite rejects RS256
const MAX_JWT_LIFETIME_SECONDS = 3600; // exp must not exceed iat + 3600
// The JWT payload must include a `scope` claim naming the scope(s) enabled
// on the Integration record, e.g. ["rest_webservices"] - without it the
// token endpoint returns HTTP 400 {"error":"invalid_request"} with no
// further detail. Confirmed against a real account.
const DEFAULT_SCOPE = ['rest_webservices'];
// The JWT-bearer assertion is single-use - it's only ever sent once, in the
// same request that trades it for an access token - so it needs just enough
// lifetime to cover clock drift between this machine and NetSuite, not the
// full hour NetSuite allows. This is unrelated to the access token's own
// lifetime, which NetSuite sets via the token response's `expires_in` and
// which `jwtLifetimeSeconds` has no influence over.
const DEFAULT_JWT_LIFETIME_SECONDS = 300;

/**
 * NetSuite account IDs (e.g. "1234567_SB1") map to API domains by replacing
 * underscores with hyphens and lowercasing (e.g. "1234567-sb1"). Centralized
 * here so no caller ever pastes a raw account ID into a URL.
 */
function domainFor(accountId) {
  if (!accountId || typeof accountId !== 'string') {
    throw new Error('accountId must be a non-empty string');
  }
  return accountId.replace(/_/g, '-').toLowerCase();
}

function tokenUrlFor(accountId) {
  return `https://${domainFor(accountId)}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token`;
}

function suiteQlUrlFor(accountId) {
  return `https://${domainFor(accountId)}.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql`;
}

/**
 * Thin wrapper around the generic core token client that encodes NetSuite's
 * specific requirements: PS256 signing, no `aud` claim, a `scope` claim
 * matching the Integration record's enabled scope(s), `kid` set to the
 * Certificate ID, `iss` set to the Integration record's Client ID, and the
 * account-specific token endpoint. All signing, token exchange, and caching
 * is delegated to core - this module adds no logic of its own beyond
 * shaping those inputs.
 *
 * `scope` defaults to `["rest_webservices"]`; pass a string or array to
 * match whatever scope(s) are enabled on your Integration record (e.g.
 * `["rest_webservices", "restlets"]`).
 */
function createNetSuiteTokenClient({
  accountId,
  clientId,
  certificateId,
  privateKey,
  subject,
  scope = DEFAULT_SCOPE,
  extraClaims,
  jwtLifetimeSeconds = DEFAULT_JWT_LIFETIME_SECONDS,
  clockSkewSeconds,
  fetch,
  now,
}) {
  if (!accountId) throw new Error('accountId is required');
  if (!clientId) throw new Error('clientId is required');
  if (!certificateId) throw new Error('certificateId is required');
  if (!privateKey) throw new Error('privateKey is required');
  if (jwtLifetimeSeconds > MAX_JWT_LIFETIME_SECONDS) {
    throw new Error(
      `jwtLifetimeSeconds (${jwtLifetimeSeconds}) exceeds NetSuite's maximum of ${MAX_JWT_LIFETIME_SECONDS}s (iat + 3600)`
    );
  }

  return createTokenClient({
    tokenUrl: tokenUrlFor(accountId),
    algorithm: NETSUITE_JWT_ALGORITHM,
    privateKey,
    issuer: clientId,
    header: { kid: certificateId },
    subject,
    // Deliberately no `audience` option: NetSuite confirmed to respond
    // with invalid_grant when the assertion carries an `aud` claim.
    extraClaims: { scope: Array.isArray(scope) ? scope : [scope], ...extraClaims },
    jwtLifetimeSeconds,
    clockSkewSeconds,
    fetch,
    now,
  });
}

module.exports = {
  domainFor,
  tokenUrlFor,
  suiteQlUrlFor,
  createNetSuiteTokenClient,
};
