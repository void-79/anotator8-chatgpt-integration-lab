/**
 * src/server/oauth/issuer-factory.ts
 *
 * Picks the right `TokenValidator` for the deployment mode.
 *
 * Modes:
 *   - "local"     — lab's in-process AS issues and validates RS256 JWTs
 *                   (default; perfect for self-hosted demos and CI).
 *   - "external"  — lab validates JWTs minted by a managed IdP
 *                   (Auth0/Okta/Cognito/Stytch/Keycloak) by fetching
 *                   the IdP's JWKS. The in-process AS endpoints are
 *                   disabled (see `as-handlers.ts`).
 *
 * Selection is driven by the `MCP_OAUTH_MODE` env var. Defaults to
 * "local" to preserve v0.7.x behavior. Cutting over to a production
 * IdP is a config change, not a code change.
 *
 * Spec: RFC 8414 (AS metadata) — the local AS publishes its own
 * metadata; the external mode points clients at the IdP's metadata
 * via RFC 9728 PRM.
 */
import { createRemoteTokenValidator, type RemoteTokenValidator, type RemoteValidatorConfig } from "./remote-issuer.js";
import { createTokenIssuer, type TokenIssuer, type TokenIssuerConfig, type TokenValidator } from "./token-issuer.js";

export type OauthMode = "local" | "external";

export interface LocalFactoryConfig {
  readonly mode: "local";
  readonly issuer: string;
  readonly resource: string;
  readonly tokenTtlSeconds: number;
  readonly defaultSubject: string;
}

export interface ExternalFactoryConfig {
  readonly mode: "external";
  readonly issuer: string;
  readonly resource: string;
  /** IdP issuer URL (the `iss` claim your IdP puts in its JWTs). */
  readonly idpIssuer: string;
  /** IdP JWKS URL. Sourced from the IdP's discovery document. */
  readonly jwksUrl: string;
  /** Optional: cache TTL override (ms). Default 5 min. */
  readonly cacheTtlMs?: number;
  /** Optional: clock skew for exp/nbf (seconds). Default 0. */
  readonly clockSkewSeconds?: number;
}

export type IssuerFactoryConfig = LocalFactoryConfig | ExternalFactoryConfig;

export interface IssuerFactoryResult {
  readonly mode: OauthMode;
  /** The validator used by `auth.ts` to protect /mcp. */
  readonly validator: TokenValidator;
  /**
   * Local issuer (only present in `local` mode). `app.ts` mounts the
   * AS endpoints only when this is present; in `external` mode those
   * routes return 404.
   */
  readonly localIssuer?: TokenIssuer;
  /**
   * Human-readable one-liner describing which IdP/issuer is active.
   * Surfaced in the AS metadata and the startup banner.
   */
  readonly description: string;
}

/**
 * Build a `TokenValidator` (and optional local issuer) from config.
 * Throws if the config is invalid — e.g. `external` mode without
 * `jwksUrl` or `idpIssuer`.
 */
export function createIssuerFactory(config: IssuerFactoryConfig): IssuerFactoryResult {
  if (config.mode === "local") {
    const localConfig: TokenIssuerConfig = {
      issuer: config.issuer,
      resource: config.resource,
      tokenTtlSeconds: config.tokenTtlSeconds,
      defaultSubject: config.defaultSubject,
    };
    const localIssuer = createTokenIssuer(localConfig);
    return {
      mode: "local",
      validator: localIssuer,
      localIssuer,
      description: `local in-process AS @ ${config.issuer} (resource=${config.resource})`,
    };
  }

  // external
  if (!config.jwksUrl) {
    throw new Error("external mode requires jwksUrl");
  }
  if (!config.idpIssuer) {
    throw new Error("external mode requires idpIssuer");
  }
  const labIssuerNorm = config.issuer.replace(/\/+$/, "");
  const idpIssuerNorm = config.idpIssuer.replace(/\/+$/, "");
  if (idpIssuerNorm !== labIssuerNorm) {
    // The lab's `issuer` (the resource's issuer) and the IdP's
    // `iss` claim MUST be aligned in v0.8.0. If you need to
    // distinguish them, that's a v0.9.0 conversation.
    throw new Error(
      `external mode: lab issuer (${config.issuer}) must equal IdP issuer (${config.idpIssuer}). ` +
        "Set MCP_OAUTH_ISSUER to the IdP's issuer URL.",
    );
  }
  const remoteConfig: RemoteValidatorConfig = {
    issuer: config.issuer,
    resource: config.resource,
    jwksUrl: config.jwksUrl,
    cacheTtlMs: config.cacheTtlMs,
    clockSkewSeconds: config.clockSkewSeconds,
  };
  const remote = createRemoteTokenValidator(remoteConfig);
  const result: IssuerFactoryResult = {
    mode: "external",
    validator: remote,
    description: `external IdP @ ${config.idpIssuer} (JWKS: ${config.jwksUrl})`,
  };
  return result;
}

/**
 * Read the `MCP_OAUTH_MODE` env var. Returns `"local"` if unset
 * (preserves v0.7.x default behavior). Any value other than
 * `"external"` is treated as `"local"`.
 */
export function readOauthModeFromEnv(env: NodeJS.ProcessEnv = process.env): OauthMode {
  const raw = (env.MCP_OAUTH_MODE ?? "").toLowerCase().trim();
  if (raw === "external") return "external";
  return "local";
}
