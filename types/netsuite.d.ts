/**
 * Thin NetSuite-specific adapter over the generic core. See
 * src/adapters/netsuite/.
 */

import type { TokenClient } from './index';

/** Converts a NetSuite account ID (e.g. "1234567_SB1") to its API domain form (e.g. "1234567-sb1"). */
export function domainFor(accountId: string): string;

/** The account-specific OAuth 2.0 token endpoint URL. */
export function tokenUrlFor(accountId: string): string;

/** The account-specific SuiteQL REST endpoint URL. */
export function suiteQlUrlFor(accountId: string): string;

export interface NetSuiteTokenClientOptions {
  /** NetSuite account ID, e.g. "1234567_SB1". */
  accountId: string;
  /** Integration record's Client ID. Used as the JWT `iss` claim. */
  clientId: string;
  /** OAuth 2.0 Client Credentials (M2M) Setup record's Certificate ID. Used as the JWT header's `kid`. */
  certificateId: string;
  /** PEM-encoded RSA private key matching the uploaded certificate. */
  privateKey: string | Buffer;
  /** JWT `sub` claim. Omitted unless set. */
  subject?: string;
  /**
   * Scope(s) enabled on the Integration record, sent as the JWT payload's
   * `scope` claim. Defaults to `["rest_webservices"]`.
   */
  scope?: string | string[];
  /** Merged into the JWT payload as-is. */
  extraClaims?: Record<string, unknown>;
  /**
   * Lifetime of the signed assertion itself (not the access token NetSuite
   * returns). Must not exceed `3600` (NetSuite's `exp <= iat + 3600` limit).
   * Default: `300`.
   */
  jwtLifetimeSeconds?: number;
  /** Refresh the cached access token this many seconds before actual expiry. Default: `60`. */
  clockSkewSeconds?: number;
  /** Defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /** Defaults to `() => Date.now()`. */
  now?: () => number;
}

export function createNetSuiteTokenClient(options: NetSuiteTokenClientOptions): TokenClient;
