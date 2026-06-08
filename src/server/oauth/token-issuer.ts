/**
 * src/server/oauth/token-issuer.ts
 *
 * Token issuance + validation for the lab's in-process AS.
 *
 * Mints RS256 JWTs with the following claims:
 *   iss    — the AS issuer URL (matches the AS metadata)
 *   sub    — the resource owner subject (default: "demo-user")
 *   aud    — the resource indicator (RFC 8707); matches the PRM's `resource`
 *   iat    — issued at (seconds)
 *   nbf    — not-before (seconds)
 *   exp    — expires (seconds; default 900 = 15 min)
 *   scope  — space-separated scopes
 *   client_id — the registered client (CIMD URL or DCR id)
 *   jti    — random JWT ID
 *
 * The `TokenValidator` interface is the only thing the auth path
 * depends on. The local `TokenIssuer` implements it; the
 * `RemoteTokenValidator` (see `remote-issuer.ts`) implements it
 * for production IdPs. This file also exports the shared
 * `validateClaims` helper so the iss/aud/exp/nbf/scope checks are
 * identical for both implementations.
 *
 * Spec: RFC 7519 (JWT) + RFC 8725 (JWT BCP) + RFC 8707 (resource indicators).
 */
import { randomUUID } from "node:crypto";
import { generateSigningKey, jwksFromKey, signJwt, verifyJwt, type JwkSet, type SigningKey } from "./jwks.js";

export interface TokenIssuerConfig {
  readonly issuer: string;
  readonly resource: string;
  readonly tokenTtlSeconds: number;
  readonly defaultSubject: string;
}

export interface IssuedTokenClaims {
  readonly iss: string;
  readonly sub: string;
  readonly aud: string;
  readonly iat: number;
  readonly nbf: number;
  readonly exp: number;
  readonly scope: string;
  readonly client_id: string;
  readonly jti: string;
}

export interface IssueInput {
  readonly clientId: string;
  readonly scope: ReadonlyArray<string>;
  readonly resource: string | undefined;
  readonly subject: string | undefined;
}

export interface ValidatedToken {
  readonly claims: IssuedTokenClaims;
  readonly scopes: ReadonlyArray<string>;
}

/**
 * The minimal contract the auth path needs from a token source.
 * `validate` returns the parsed claims + scopes or throws
 * `TokenValidationError`. May be sync (local issuer) or async
 * (remote validator — network round-trip to fetch JWKS).
 * The `jwks` is published for clients that want to verify
 * tokens themselves (the local issuer; the remote validator
 * exposes the IdP's URL instead).
 */
export interface TokenValidator {
  readonly config: { readonly issuer: string; readonly resource: string };
  readonly jwks: JwkSet | { readonly url: string };
  validate(token: string, requiredScopes: ReadonlyArray<string>): ValidatedToken | Promise<ValidatedToken>;
}

/** Local issuer: mints RS256 JWTs and validates them with the same key. */
export interface TokenIssuer extends TokenValidator {
  readonly config: TokenIssuerConfig;
  readonly signingKey: SigningKey;
  readonly jwks: JwkSet;
  issue(input: IssueInput): IssuedTokenClaims & { token: string };
  validate(token: string, requiredScopes: ReadonlyArray<string>): ValidatedToken;
}

export class TokenValidationError extends Error {
  constructor(
    readonly code: "invalid_token" | "insufficient_scope" | "invalid_audience" | "invalid_issuer" | "expired" | "not_yet_valid" | "malformed",
    message: string,
  ) {
    super(message);
    this.name = "TokenValidationError";
  }
}

/**
 * Shared post-signature validation: iss, aud, exp, nbf, scope.
 * Used by both `createTokenIssuer` (local) and
 * `createRemoteTokenValidator` (external IdP).
 *
 * Takes the raw JWT payload (already signature-verified) and a
 * config describing the expected issuer + resource.
 */
export function validateClaims(
  raw: Record<string, unknown>,
  config: { readonly issuer: string; readonly resource: string },
  requiredScopes: ReadonlyArray<string>,
): ValidatedToken {
  if (raw.iss !== config.issuer) {
    throw new TokenValidationError("invalid_issuer", `Expected iss=${config.issuer}, got ${String(raw.iss)}`);
  }
  const auds: string[] = Array.isArray(raw.aud) ? (raw.aud as string[]) : [String(raw.aud)];
  if (!auds.includes(config.resource)) {
    throw new TokenValidationError("invalid_audience", `Token aud does not include ${config.resource}`);
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof raw.exp !== "number" || raw.exp <= now) {
    throw new TokenValidationError("expired", "Token expired");
  }
  if (typeof raw.nbf === "number" && raw.nbf > now) {
    throw new TokenValidationError("not_yet_valid", "Token not yet valid");
  }
  const scopeString = typeof raw.scope === "string" ? raw.scope : "";
  const scopes = scopeString.split(/\s+/).filter(Boolean);
  for (const required of requiredScopes) {
    if (!scopes.includes(required)) {
      throw new TokenValidationError("insufficient_scope", `Missing scope: ${required}`);
    }
  }
  return {
    claims: raw as unknown as IssuedTokenClaims,
    scopes,
  };
}

export function createTokenIssuer(config: TokenIssuerConfig): TokenIssuer {
  const signingKey = generateSigningKey();
  const jwks = jwksFromKey(signingKey);

  return {
    config,
    signingKey,
    jwks,
    issue(input) {
      const now = Math.floor(Date.now() / 1000);
      const claims: IssuedTokenClaims = {
        iss: config.issuer,
        sub: input.subject ?? config.defaultSubject,
        aud: input.resource ?? config.resource,
        iat: now,
        nbf: now,
        exp: now + config.tokenTtlSeconds,
        scope: input.scope.join(" "),
        client_id: input.clientId,
        jti: randomUUID(),
      };
      const token = signJwt(signingKey, claims as unknown as Record<string, unknown>);
      return { ...claims, token };
    },
    validate(token, requiredScopes) {
      let raw: Record<string, unknown>;
      try {
        raw = verifyJwt(token, signingKey);
      } catch (error) {
        throw new TokenValidationError("invalid_token", `JWT signature verification failed: ${(error as Error).message}`);
      }
      return validateClaims(raw, config, requiredScopes);
    },
  };
}

