/**
 * src/server/oauth/remote-issuer.ts
 *
 * `RemoteTokenValidator` validates RS256 JWTs minted by an external
 * IdP (Auth0/Okta/Cognito/Stytch/Keycloak) by fetching and caching
 * the IdP's published JWKS.
 *
 * Why this exists:
 *   The lab ships with an in-process AS (see `token-issuer.ts`) that
 *   is fine for self-hosted demos, but for the App Store / production
 *   you must point clients at a managed IdP. This module is the
 *   seam: the auth path (`src/server/auth.ts`) depends only on the
 *   `TokenValidator` interface, so swapping the local issuer for
 *   a `RemoteTokenValidator` is the only change required to cut
 *   over to a production IdP.
 *
 * Spec: RFC 7517 (JWKS) + RFC 7515 (JWS) + RFC 8414 (AS metadata).
 */
import { createPublicKey, type KeyObject } from "node:crypto";
import { createVerify } from "node:crypto";
import { TokenValidationError, validateClaims, type IssuedTokenClaims, type TokenValidator, type ValidatedToken } from "./token-issuer.js";

export interface RemoteValidatorConfig {
  /** Expected `iss` claim in incoming tokens. MUST match the IdP's issuer URL exactly. */
  readonly issuer: string;
  /** Expected `aud` claim. Matches the lab's resource (PRM `resource`). */
  readonly resource: string;
  /**
   * URL of the IdP's JWKS endpoint. Sourced from the IdP's
   * `/.well-known/openid-configuration` or RFC 8414 metadata.
   */
  readonly jwksUrl: string;
  /** Cache TTL in milliseconds. Default 5 minutes. */
  readonly cacheTtlMs?: number;
  /** Allowed clock skew in seconds for `exp` / `nbf`. Default 0 (strict). */
  readonly clockSkewSeconds?: number;
  /** Override the fetch implementation (test injection point). */
  readonly fetchImpl?: typeof fetch;
  /** Override Date.now (test injection point). */
  readonly now?: () => number;
}

interface CachedJwks {
  readonly jwks: RemoteJwkSet;
  readonly fetchedAt: number;
}

interface RemoteJwkSet {
  readonly keys: ReadonlyArray<RemoteJwk>;
}

interface RemoteJwk {
  readonly kty: string;
  readonly kid?: string;
  readonly alg?: string;
  readonly use?: string;
  readonly n?: string;
  readonly e?: string;
  // EC params (rare but possible)
  readonly crv?: string;
  readonly x?: string;
  readonly y?: string;
  // Allow extra fields from real IdPs (Keycloak, Auth0, Okta) without
  // tripping strict typing — `createPublicKey` reads only what it needs.
  readonly [extra: string]: unknown;
}

export interface RemoteTokenValidator extends TokenValidator {
  readonly config: { readonly issuer: string; readonly resource: string; readonly jwksUrl: string };
  readonly jwks: { readonly url: string };
  /** Force a refetch on the next validate() call. Useful in tests + on key rotation signals. */
  invalidate(): void;
  validate(token: string, requiredScopes: ReadonlyArray<string>): Promise<ValidatedToken>;
}

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_FETCH_TIMEOUT_MS = 5000;

/**
 * Build a `RemoteTokenValidator`. Throws nothing at construction;
 * the first JWKS fetch happens lazily inside `validate()` so that
 * process startup is not blocked by an IdP outage.
 */
export function createRemoteTokenValidator(config: RemoteValidatorConfig): RemoteTokenValidator {
  const cacheTtlMs = config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const fetchImpl: typeof fetch = config.fetchImpl ?? ((url, init) => fetch(url, init));
  const now = config.now ?? (() => Date.now());

  let cache: CachedJwks | null = null;
  // Serialize concurrent fetches so we don't fan-out on a cold cache.
  let inflight: Promise<CachedJwks> | null = null;

  async function fetchJwks(force = false): Promise<CachedJwks> {
    if (!force && cache && now() - cache.fetchedAt < cacheTtlMs) {
      return cache;
    }
    if (!force && inflight) {
      return inflight;
    }
    inflight = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DEFAULT_FETCH_TIMEOUT_MS);
      try {
        const res = await fetchImpl(config.jwksUrl, {
          method: "GET",
          headers: { accept: "application/json" },
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new TokenValidationError("invalid_token", `JWKS fetch returned HTTP ${res.status}`);
        }
        let body: RemoteJwkSet;
        try {
          body = (await res.json()) as RemoteJwkSet;
        } catch (error) {
          throw new TokenValidationError("invalid_token", `JWKS document is not valid JSON: ${(error as Error).message}`);
        }
        if (!body || !Array.isArray(body.keys)) {
          throw new TokenValidationError("invalid_token", "JWKS document missing 'keys' array");
        }
        const fresh: CachedJwks = { jwks: body, fetchedAt: now() };
        cache = fresh;
        return fresh;
      } finally {
        clearTimeout(timer);
        inflight = null;
      }
    })();
    return inflight;
  }

  function jwkToKeyObject(jwk: RemoteJwk): KeyObject {
    if (jwk.kty === "RSA") {
      if (!jwk.n || !jwk.e) {
        throw new Error("RSA JWK missing n/e");
      }
      return createPublicKey({ key: jwk, format: "jwk" });
    }
    if (jwk.kty === "EC") {
      if (!jwk.crv || !jwk.x || !jwk.y) {
        throw new Error("EC JWK missing crv/x/y");
      }
      return createPublicKey({ key: jwk, format: "jwk" });
    }
    throw new Error(`Unsupported JWK kty: ${jwk.kty}`);
  }

  function pickAlg(jwk: RemoteJwk, headerAlg: string): string {
    // Prefer the JWK's declared alg if present; else trust the JWT header.
    return jwk.alg ?? headerAlg;
  }

  function verifierForAlg(alg: string): { name: string; sign: string } {
    switch (alg) {
      case "RS256":
        return { name: "RSA-SHA256", sign: "RSA-SHA256" };
      case "RS384":
        return { name: "RSA-SHA384", sign: "RSA-SHA384" };
      case "RS512":
        return { name: "RSA-SHA512", sign: "RSA-SHA512" };
      case "PS256":
        return { name: "RSA-SHA256", sign: "RSA-PSS" };
      case "PS384":
        return { name: "RSA-SHA384", sign: "RSA-PSS" };
      case "PS512":
        return { name: "RSA-SHA512", sign: "RSA-PSS" };
      case "ES256":
        return { name: "sha256", sign: "sha256" };
      case "ES384":
        return { name: "sha384", sign: "sha384" };
      case "ES512":
        return { name: "sha512", sign: "sha512" };
      default:
        throw new Error(`Unsupported JWT alg: ${alg}`);
    }
  }

  return {
    config: { issuer: config.issuer, resource: config.resource, jwksUrl: config.jwksUrl },
    jwks: { url: config.jwksUrl },
    invalidate() {
      cache = null;
    },
    async validate(token: string, requiredScopes: ReadonlyArray<string>): Promise<ValidatedToken> {
      // 1. Parse header + payload without verifying yet.
      const parts = token.split(".");
      if (parts.length !== 3) {
        throw new TokenValidationError("malformed", "JWT is not a 3-part compact serialization");
      }
      const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];
      let header: { alg?: string; kid?: string; typ?: string };
      let payload: Record<string, unknown>;
      try {
        header = JSON.parse(Buffer.from(base64UrlDecode(headerB64)).toString("utf8")) as { alg?: string; kid?: string; typ?: string };
        payload = JSON.parse(Buffer.from(base64UrlDecode(payloadB64)).toString("utf8")) as Record<string, unknown>;
      } catch (error) {
        throw new TokenValidationError("malformed", `JWT is not valid JSON: ${(error as Error).message}`);
      }
      if (!header.alg) {
        throw new TokenValidationError("malformed", "JWT header missing alg");
      }
      // 2. Resolve the key. Try cache first, then a forced refetch on kid miss
      //    so a freshly rotated key from the IdP is picked up automatically.
      let keyObj: KeyObject | null = null;
      let keyAlg: string | null = null;
      const tryKeys = (jwks: RemoteJwkSet): RemoteJwk | null => {
        if (header.kid) {
          return jwks.keys.find((k) => k.kid === header.kid) ?? null;
        }
        // No kid in header: only safe to use if the JWKS has exactly one sig key.
        const sigKeys = jwks.keys.filter((k) => k.use === "sig" || !k.use);
        return sigKeys.length === 1 ? (sigKeys[0] ?? null) : null;
      };

      const cached = await fetchJwks(false);
      const matched = tryKeys(cached.jwks);
      if (matched) {
        keyObj = jwkToKeyObject(matched);
        keyAlg = pickAlg(matched, header.alg);
      } else if (header.kid) {
        // Cache miss with a kid — could be key rotation. Force a refetch.
        const refetched = await fetchJwks(true);
        const rematched = tryKeys(refetched.jwks);
        if (rematched) {
          keyObj = jwkToKeyObject(rematched);
          keyAlg = pickAlg(rematched, header.alg);
        }
      }
      if (!keyObj || !keyAlg) {
        throw new TokenValidationError("invalid_token", `No matching JWK for kid=${String(header.kid)}`);
      }
      if (keyAlg !== header.alg) {
        throw new TokenValidationError("invalid_token", `JWK alg (${keyAlg}) does not match JWT alg (${header.alg})`);
      }
      // 3. Verify signature.
      const { sign } = verifierForAlg(header.alg);
      let verifier: ReturnType<typeof createVerify>;
      try {
        verifier = createVerify(sign);
      } catch (error) {
        throw new TokenValidationError("invalid_token", `Unsupported alg: ${header.alg}`);
      }
      verifier.update(`${headerB64}.${payloadB64}`);
      verifier.end();
      const signature = base64UrlDecode(signatureB64);
      const ok = verifier.verify(keyObj, signature);
      if (!ok) {
        throw new TokenValidationError("invalid_token", "JWT signature verification failed");
      }
      // 4. Apply shared post-signature checks.
      return validateClaims(payload, { issuer: config.issuer, resource: config.resource }, requiredScopes);
    },
  };
}

function base64UrlDecode(s: string): Buffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice(0, (4 - (s.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}
