# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities privately using GitHub's private
vulnerability reporting, not as a public issue:

https://github.com/budysutjijati/netsuite-oauth20/security/advisories/new

Include a description of the issue, steps to reproduce, and the affected
version. Do not include real NetSuite credentials, private keys, or
account identifiers in the report.

## Supported versions

This project is pre-1.0 (`0.x`). Security fixes are made against the
latest published version only.

## Handling a leaked key

If a private key used with this package is ever exposed, that is not a
vulnerability in this package to report - revoke it immediately: replace
the Certificate on the OAuth 2.0 Client Credentials (M2M) Setup record in
NetSuite, generate a new key pair, and update it wherever the old key was
stored. See `docs/NETSUITE_SETUP.md` and the README's "Security" section.
