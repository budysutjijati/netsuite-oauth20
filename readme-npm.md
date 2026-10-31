# netsuite-oauth20

A zero-dependency OAuth 2.0 **Client Credentials (Machine-to-Machine)**
client, authenticating via a JWT-bearer client assertion
([RFC 7523 §2.2](https://www.rfc-editor.org/rfc/rfc7523#section-2.2)), with a
thin NetSuite adapter on top.

**Full documentation - architecture diagrams, the NetSuite setup guide,
troubleshooting, and security notes - lives on GitHub:**
https://github.com/budysutjijati/netsuite-oauth20#readme

## Install

```sh
npm install netsuite-oauth20
```

## Quick usage

Create a `.env` file with your four NetSuite values
(`NETSUITE_ACCOUNT_ID`, `NETSUITE_CLIENT_ID`, `NETSUITE_CERTIFICATE_ID`,
`NETSUITE_PRIVATE_KEY_PATH`), then run the snippet below with
`node --env-file=.env` to load it (no `dotenv` package needed):

```js
const fs = require('fs');
const { createNetSuiteTokenClient, suiteQlUrlFor } = require('netsuite-oauth20/netsuite');

async function main() {
  const client = createNetSuiteTokenClient({
    accountId: process.env.NETSUITE_ACCOUNT_ID,         // e.g. "1234567_SB1"
    clientId: process.env.NETSUITE_CLIENT_ID,           // Integration record's Client ID
    certificateId: process.env.NETSUITE_CERTIFICATE_ID, // M2M Setup record's Certificate ID
    privateKey: fs.readFileSync(process.env.NETSUITE_PRIVATE_KEY_PATH, 'utf8'),
  });

  const accessToken = await client.getAccessToken();

  const response = await fetch(suiteQlUrlFor(process.env.NETSUITE_ACCOUNT_ID), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'transient',
    },
    body: JSON.stringify({ q: "SELECT Symbol, Name, ExchangeRate, DisplaySymbol, SymbolPlacement, CurrencyPrecision, IsBaseCurrency FROM Currency WHERE ( IsInactive = 'F' ) ORDER BY Symbol" }),
  });
}

main();
```

## Why this package

- **Zero npm dependencies** - only Node's built-in `crypto` and `fetch`
  (Node >= 20.6).
- **Two layers** - a provider-agnostic core, and a thin NetSuite adapter
  encoding NetSuite's specific quirks (PS256 signing, a required `scope`
  claim, no `aud` claim, an up-to-1-hour access token, and more).
- **Client Credentials (M2M/JWT) only** - no Authorization Code / browser
  consent flow.

See the [full README on GitHub](https://github.com/budysutjijati/netsuite-oauth20#readme)
for the complete NetSuite setup guide, an architecture walkthrough,
troubleshooting, and security notes.

## License

MIT
