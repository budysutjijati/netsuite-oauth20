# Changelog

## 0.2.0

### Fixed
- Broken SuiteQL query in the README's "Usage - NetSuite adapter" example
  (stray comma and tab character made it invalid SuiteQL).
- `expires_in` is now coerced with `Number(...)` instead of requiring a
  JSON number, so an OAuth server that sends it as a numeric string no
  longer defeats in-memory caching. (Verified live against a real
  NetSuite account: it does send a JSON number, so this wasn't an
  observed bug against NetSuite specifically - just unwarranted strictness
  in the provider-agnostic core.)
- Top-level `await` in the README and `readme-npm.md` code snippets,
  which threw a `SyntaxError` if pasted into a CommonJS `.js` file as-is;
  wrapped in `async function main() { ... }`.
- Wrong "see Proven NetSuite quirks below" cross-reference in
  Troubleshooting (that section is above it).
- `docs/NETSUITE_SETUP.md`'s manual `openssl req` command now passes
  `-subj` so it doesn't prompt interactively, matching
  `scripts/generate-netsuite-cert.js`.

### Changed
- Lowered `engines.node` from `>=26` to `>=20.6`, the actual minimum for
  global `fetch`, PSS (PS256) signing, and `--env-file`. `.nvmrc` stays
  pinned to the current LTS line for this repo's own contributors/CI.
- `createNetSuiteTokenClient()`'s default `jwtLifetimeSeconds` changed
  from `3600` to `300`. The assertion is single-use and consumed
  immediately, so it only needs enough lifetime to absorb clock drift,
  not NetSuite's full 1-hour hard limit. The `3600` cap is unchanged.
- `examples/netsuite-suiteql-smoke-test.js` now imports via the package
  name (`netsuite-oauth20`, `netsuite-oauth20/netsuite`) instead of
  reaching into `src/`, so it demonstrates real consumer usage.
- `docs/NETSUITE_SETUP.md` now also calls out enabling the **REST Web
  Services** feature and lists the specific role permissions
  (`REST Web Services`, `Log in using OAuth 2.0 Access Tokens`) needed on
  the OAuth 2.0 Client Credentials (M2M) Setup record's Role.

### Added
- A `node:test` suite (`npm test`, scoped to `test/`) covering the core
  token client, JWT signing (verified with `crypto.verify` for every
  supported algorithm), error summarization, and the NetSuite adapter.
- Hand-written `.d.ts` types for both the root and `/netsuite` exports.
- `SECURITY.md` (GitHub private vulnerability reporting).

## 0.1.0

Initial release: zero-dependency OAuth 2.0 Client Credentials (M2M)
client using a JWT-bearer client assertion (RFC 7523 §2.2), split into a
provider-agnostic core (`src/core/`) and a thin NetSuite adapter
(`src/adapters/netsuite/`), plus a runnable SuiteQL smoke-test example and
NetSuite setup documentation.
