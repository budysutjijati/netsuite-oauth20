# NetSuite setup for OAuth 2.0 Client Credentials (M2M)

Manual, one-time steps an account administrator performs in NetSuite before
the example in `examples/netsuite-suiteql-smoke-test.js` will work. All
values below are generic placeholders - substitute your own.

## 1. Enable the features

**Setup > Company > Enable Features > SuiteCloud** - check both:

- OAuth 2.0 
- **REST Web Services** - without this, SuiteQL requests over REST fail
  even when token issuance itself works.

## 2. Generate an RSA key pair

Generate an RSA key pair (2048-bit or larger) **on the machine that will
actually integrate with NetSuite** (e.g. the server or environment running
`examples/netsuite-suiteql-smoke-test.js`) - the private key must never
leave that machine. Keep the private key file off of version control
(already covered by `.gitignore`: `*.pem`, `*.key`, `.certs/`, etc.) and
never paste it inline into an environment variable - the example reads it
from a file path via `NETSUITE_PRIVATE_KEY_PATH`.

**Option A - use the included script** (no npm dependencies; it shells out
to your system's `openssl`, same as option B below, but prompts you for the
integration name and writes both files into the already-`.gitignore`d
`.certs/` directory):

```sh
npm run setup:netsuite-cert
```

**Option B - run openssl yourself:**

```sh
openssl genrsa -out your-integration-name.private-key.pem 2048
openssl req -new -x509 -key your-integration-name.private-key.pem \
  -out your-integration-name.certificate.pem -days 365 \
  -subj "/CN=your-integration-name"
```

(Naming the files `.private-key.pem` and `.certificate.pem` rather than
the more common but ambiguous `.pem`/`.pub.pem` - it should be obvious at a
glance, from the filename alone, which one is secret.)

Either way, the outcome of this step is handing off the resulting public
certificate (`your-integration-name.certificate.pem`) - and only that
file, never the private key - to whoever administers NetSuite, since it's
needed to upload as the **Certificate** when creating the OAuth 2.0 Client
Credentials (M2M) Setup record in step 4. If you are that administrator,
this is just you keeping the certificate file for the next step.

## 3. Create an Integration record

**Setup > Integration > Manage Integrations > New**

- Name: `your-integration-name`
- Under **Client Credentials (Machine to Machine) Grant**: enable it.
- **Scope**: include at least `REST Web Services`.
- Save. Note the generated **Client ID** - this becomes `NETSUITE_CLIENT_ID`
  and is used as the JWT `iss` claim.

## 4. Create an OAuth 2.0 Client Credentials (M2M) Setup record

**Setup > Users/Roles > OAuth 2.0 Client Credentials (M2M) Setup > New**

This record ties together:

- **Entity**: the employee/vendor/partner record acting as the integration
  user. This Entity must have the Role below assigned to it.
- **Role**: a role whose permissions include, at minimum:
  - **REST Web Services** (Setup category).
  - **Log in using OAuth 2.0 Access Tokens** (Setup category) - without
    this permission, a token issued by this flow is rejected at the API
    even though the token request itself succeeds.
  - Plus whatever record/transaction permissions the specific
    records/suitelets/restlets/SuiteQL queries you intend to call require
    (e.g. querying `employee` needs more than base REST Web Services
    access in some role configurations).
- **Application**: the Integration record created in step 3.
- **Certificate**: upload the public certificate from step 2.

Saving this record produces a **Certificate ID** - this becomes
`NETSUITE_CERTIFICATE_ID` and is used as the JWT header's `kid`.

## 5. Determine your account ID

Your account ID is visible in NetSuite's URL bar or under
**Setup > Company > Company Information**, e.g. `1234567` for production or
`1234567_SB1` for a sandbox. Use it as-is (with the underscore) for
`NETSUITE_ACCOUNT_ID` - the package's `domainFor()` helper converts it to
the lowercase, hyphenated API domain form for you.

## 6. Run the example

Two equivalent ways to supply the four required environment variables:

**Option A - shell exports:**

```sh
export NETSUITE_ACCOUNT_ID=1234567_SB1
export NETSUITE_CLIENT_ID=<Client ID from step 3>
export NETSUITE_CERTIFICATE_ID=<Certificate ID from step 4>
export NETSUITE_PRIVATE_KEY_PATH=/path/to/your-integration-name.private-key.pem

npm run example:netsuite
```

**Option B - `.env` file** (uses Node's native `--env-file` flag; requires
Node >= 20.6, the package's `engines.node` floor):

```sh
cp .env.example .env
# edit .env with your real values - it's already covered by .gitignore

npm run example:netsuite:dotenv
```

Expected output either way: a `[PASS]` line for the token request, followed
by a `[PASS]` line for the `SELECT 1 AS ok FROM dual` SuiteQL query.
