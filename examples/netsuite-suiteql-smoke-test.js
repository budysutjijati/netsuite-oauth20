'use strict';

/**
 * Read-only smoke test proving the core + NetSuite adapter work end-to-end
 * against a real NetSuite account:
 *
 *   1. Obtain an access token via Client Credentials (M2M/JWT).
 *   2. Run one trivial, read-only SuiteQL query.
 *
 * It touches no write/record-mutating endpoint. See docs/NETSUITE_SETUP.md
 * for the one-time NetSuite-admin setup this script requires.
 *
 * Required environment variables:
 *   NETSUITE_ACCOUNT_ID          e.g. "1234567_SB1"
 *   NETSUITE_CLIENT_ID           Integration record's Client ID
 *   NETSUITE_CERTIFICATE_ID      OAuth 2.0 M2M Setup record's Certificate ID
 *   NETSUITE_PRIVATE_KEY_PATH    path to the matching RSA private key (PEM)
 */

const fs = require('fs');
const { createNetSuiteTokenClient, suiteQlUrlFor } = require('netsuite-oauth20/netsuite');
const { summarizeErrorBody } = require('netsuite-oauth20');

const REQUIRED_ENV_VARS = [
  'NETSUITE_ACCOUNT_ID',
  'NETSUITE_CLIENT_ID',
  'NETSUITE_CERTIFICATE_ID',
  'NETSUITE_PRIVATE_KEY_PATH',
];

function loadConfig() {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
  }

  const privateKey = fs.readFileSync(process.env.NETSUITE_PRIVATE_KEY_PATH, 'utf8');

  return {
    accountId: process.env.NETSUITE_ACCOUNT_ID,
    clientId: process.env.NETSUITE_CLIENT_ID,
    certificateId: process.env.NETSUITE_CERTIFICATE_ID,
    privateKey,
  };
}

async function main() {
  const config = loadConfig();

  const client = createNetSuiteTokenClient(config);

  let accessToken;
  try {
    accessToken = await client.getAccessToken();
    console.log('[PASS] Token obtained via Client Credentials (M2M/JWT)');
  } catch (err) {
    console.log('[FAIL] Token request failed:', err.message);
    process.exitCode = 1;
    return;
  }

  try {
    const response = await fetch(suiteQlUrlFor(config.accountId), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'transient',
      },
      body: JSON.stringify({ q: "SELECT Symbol, Name, ExchangeRate, DisplaySymbol, SymbolPlacement, CurrencyPrecision, IsBaseCurrency FROM Currency WHERE ( IsInactive = 'F' ) ORDER BY Symbol" }),
    });

    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${summarizeErrorBody(json, text)}`);
    }

    const rows = json && Array.isArray(json.items) ? json.items : [];
    console.log(`[PASS] SuiteQL query succeeded (${rows.length} row(s)):`);
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.log('[FAIL] SuiteQL query failed:', err.message);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[FAIL] Unexpected error:', err.message);
  process.exitCode = 1;
});
