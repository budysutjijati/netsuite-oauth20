/**
 * Generic, provider-agnostic OAuth 2.0 Client Credentials client using a
 * JWT-bearer client assertion (RFC 7523 §2.2). See src/core/.
 */

export type JwtSigningAlgorithm = 'RS256' | 'RS384' | 'RS512' | 'PS256' | 'PS384' | 'PS512';

export interface SigningAlgorithmSpec {
  digest: string;
  padding?: number;
  saltLength?: number;
}

export const SIGNING_ALGORITHMS: Record<JwtSigningAlgorithm, SigningAlgorithmSpec>;

export interface SignJwtOptions {
  header?: Record<string, unknown>;
  payload: Record<string, unknown>;
  privateKey: string | Buffer;
  algorithm: JwtSigningAlgorithm;
}

export function signJwt(options: SignJwtOptions): string;

export function base64url(input: string | Buffer): string;
export function base64urlJSON(value: unknown): string;

export function summarizeErrorBody(
  json: Record<string, unknown> | null,
  rawText: string | null | undefined
): string;

export interface BuildClaimsArgs {
  issuer: string | undefined;
  nowSeconds: number;
}

export interface TokenClientOptions {
  /** OAuth 2.0 token endpoint URL. */
  tokenUrl: string;
  /** JWT signing algorithm for the client assertion. */
  algorithm: JwtSigningAlgorithm;
  /** PEM-encoded RSA private key used to sign the assertion. */
  privateKey: string | Buffer;
  /** JWT `iss` claim. Required unless `buildClaims` is provided. */
  issuer?: string;
  /** Merged into the JWT header alongside `typ`/`alg` (e.g. `{ kid }`). */
  header?: Record<string, unknown>;
  /** JWT `sub` claim. Omitted unless set. */
  subject?: string;
  /** JWT `aud` claim. Omitted unless set - never added by default. */
  audience?: string | string[];
  /** Merged into the JWT payload as-is. */
  extraClaims?: Record<string, unknown>;
  /** Full override of claim-building; replaces the default shape entirely. */
  buildClaims?: (args: BuildClaimsArgs) => Record<string, unknown>;
  /** Sent as the token request's `scope` form parameter, if set. */
  scope?: string;
  /** `exp` = `iat` + this. Default: `300`. */
  jwtLifetimeSeconds?: number;
  /** Refresh this many seconds before actual expiry. Default: `60`. */
  clockSkewSeconds?: number;
  /** Defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /** Defaults to `() => Date.now()`. */
  now?: () => number;
}

export interface TokenClient {
  /**
   * Returns a cached access token when one is still valid (beyond
   * `clockSkewSeconds`), otherwise requests a new one. Concurrent calls
   * made while a refresh is in flight share that single request.
   */
  getAccessToken(): Promise<string>;
  /** Discards any cached token, forcing the next call to re-fetch. */
  clearCache(): void;
}

export function createTokenClient(options: TokenClientOptions): TokenClient;
