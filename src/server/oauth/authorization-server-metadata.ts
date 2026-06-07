/**
 * src/server/oauth/authorization-server-metadata.ts
 *
 * OAuth 2.0 Authorization Server Metadata (RFC 8414) for the lab's
 * in-process AS. The doc is served at:
 *
 *   GET /.well-known/oauth-authorization-server
 *   GET /.well-known/openid-configuration   (alias, OpenID Connect Discovery 1.0)
 *
 * MCP 2025-11-25 § "Authorization Server Metadata" requires that an MCP AS
 * publish at least one of these two well-known endpoints. We publish both
 * (same content) so any client can discover the AS configuration.
 *
 * Spec references:
 *   - RFC 8414 (OAuth 2.0 Authorization Server Metadata)
 *     https://www.rfc-editor.org/rfc/rfc8414
 *   - OpenID Connect Discovery 1.0
 *     https://openid.net/specs/openid-connect-discovery-1_0.html
 *   - MCP 2025-11-25 authorization spec, "Authorization Server Metadata"
 *   - draft-ietf-oauth-client-id-metadata-document (CIMD)
 *
 * This module is the AS-side counterpart to protected-resource-metadata.ts.
 * It does NOT:
 *   - implement the token endpoint (token-issuer.ts)
 *   - implement the authorization endpoint (consent-page.ts + app.ts wiring)
 *   - implement DCR (dcr.ts)
 *   - implement CIMD resolution (cimd.ts)
 *   - perform JWT signature validation (jwt-validator.ts)
 *
 * The metadata document is built once at startup and re-served per request.
 * All URLs are constructed relative to the lab's MCP_OAUTH_ISSUER.
 */
import type { ServerResponse } from "node:http";

/** RFC 8414 §3 — well-known path for OAuth 2.0 Authorization Server Metadata. */
export const OAUTH_AUTHORIZATION_SERVER_WELL_KNOWN = "/.well-known/oauth-authorization-server";

/** OpenID Connect Discovery 1.0 — well-known path for the same doc. */
export const OIDC_DISCOVERY_WELL_KNOWN = "/.well-known/openid-configuration";

/** Well-known path for the JWKS publication. */
export const JWKS_PATH = "/oauth/jwks.json";

/** Lab AS endpoint paths. Kept consistent with the OpenAI Apps SDK sample JSON. */
export const AUTHORIZE_PATH = "/oauth2/v1/authorize";
export const TOKEN_PATH = "/oauth2/v1/token";
export const REGISTER_PATH = "/oauth2/v1/register";

/**
 * Subset of RFC 8414 §2 metadata parameters that the lab publishes.
 * Anything not exposed is OPTIONAL and intentionally omitted.
 */
export interface AuthorizationServerMetadata {
  /** REQUIRED — RFC 8414 §2. The AS issuer identifier. */
  readonly issuer: string;
  /** REQUIRED — RFC 8414 §2. */
  readonly authorization_endpoint: string;
  /** REQUIRED — RFC 8414 §2. */
  readonly token_endpoint: string;
  /** OPTIONAL — RFC 8414 §2. JWK Set document URL. */
  readonly jwks_uri?: string;
  /** OPTIONAL — RFC 8414 §2. RFC 7591 dynamic client registration endpoint. */
  readonly registration_endpoint?: string;
  /** OPTIONAL — RFC 8414 §2. Scopes the AS is willing to issue. */
  readonly scopes_supported?: ReadonlyArray<string>;
  /** OPTIONAL — RFC 8414 §2. */
  readonly response_types_supported: ReadonlyArray<string>;
  /** OPTIONAL — RFC 8414 §2. */
  readonly grant_types_supported: ReadonlyArray<string>;
  /** OPTIONAL — RFC 8414 §2. Token endpoint auth methods (RFC 7591 §4.2 + CIMD). */
  readonly token_endpoint_auth_methods_supported: ReadonlyArray<string>;
  /** REQUIRED when authorization_code grant is supported — RFC 8414 §2. */
  readonly code_challenge_methods_supported: ReadonlyArray<"S256" | "plain">;
  /** OPTIONAL — CIMD draft. */
  readonly client_id_metadata_document_supported?: boolean;
  /** OPTIONAL — RFC 9728 §2 mirror; some clients use this from the AS doc. */
  readonly resource_indicators_supported?: boolean;
}

/**
 * Configuration for the AS metadata. The lab always points at itself
 * (an in-process AS) in this design; a real IdP cutover is a future
 * documentation change in docs/CHATGPT_APP_SETUP.md.
 */
export interface AuthorizationServerConfig {
  /** The AS issuer URL. Defaults to `http://${MCP_HOST}:${MCP_PORT}`. */
  readonly issuer: string;
  /** Scopes the AS will issue. */
  readonly scopesSupported: ReadonlyArray<string>;
  /**
   * Whether to advertise `client_id_metadata_document_supported: true`
   * (CIMD draft). The lab always advertises it; clients that don't
   * support CIMD ignore the field.
   */
  readonly cimdSupported: boolean;
  /** Set to false in production. The lab defaults to true (plain HTTP). */
  readonly allowInsecureHttp: boolean;
}

export function loadAuthorizationServerConfig(
  env: NodeJS.ProcessEnv = process.env,
): AuthorizationServerConfig {
  const host = env.MCP_HOST ?? "127.0.0.1";
  const port = env.MCP_PORT ?? "8787";
  const issuer = env.MCP_OAUTH_ISSUER?.trim() || `http://${host}:${port}`;
  const scopesSupported = splitCsv(env.MCP_OAUTH_SCOPES_SUPPORTED, ["mcp:read"]);
  const cimdSupported = (env.MCP_OAUTH_CIMD_SUPPORTED ?? "true").toLowerCase() !== "false";
  const allowInsecureHttp = (env.MCP_OAUTH_ALLOW_INSECURE_HTTP ?? "true").toLowerCase() !== "false";
  return { issuer, scopesSupported, cimdSupported, allowInsecureHttp };
}

function splitCsv(raw: string | undefined, fallback: ReadonlyArray<string>): string[] {
  if (!raw?.trim()) return [...fallback];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Build the AS metadata doc from the config.
 * RFC 8414 §3.2: "Parameters with zero values MUST be omitted from the response".
 */
export function buildAuthorizationServerMetadata(config: AuthorizationServerConfig): AuthorizationServerMetadata {
  const issuer = stripTrailingSlash(config.issuer);
  const doc: AuthorizationServerMetadata = {
    issuer,
    authorization_endpoint: `${issuer}${AUTHORIZE_PATH}`,
    token_endpoint: `${issuer}${TOKEN_PATH}`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_basic", "client_secret_post"],
    code_challenge_methods_supported: ["S256"],
  };
  (doc as { jwks_uri: string }).jwks_uri = `${issuer}${JWKS_PATH}`;
  (doc as { registration_endpoint: string }).registration_endpoint = `${issuer}${REGISTER_PATH}`;
  if (config.scopesSupported.length > 0) {
    (doc as { scopes_supported: ReadonlyArray<string> }).scopes_supported = config.scopesSupported;
  }
  if (config.cimdSupported) {
    (doc as { client_id_metadata_document_supported: boolean }).client_id_metadata_document_supported = true;
  }
  (doc as { resource_indicators_supported: boolean }).resource_indicators_supported = true;
  return doc;
}

function stripTrailingSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

/**
 * Whether the given path is one of the lab's AS well-known endpoints.
 * Used by app.ts to route GETs without confusing them with the PRM
 * well-known at `/.well-known/oauth-protected-resource`.
 */
export function isAuthorizationServerWellKnownPath(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split("?")[0] ?? "";
  return (
    path === OAUTH_AUTHORIZATION_SERVER_WELL_KNOWN ||
    path === OIDC_DISCOVERY_WELL_KNOWN
  );
}

/**
 * Write the metadata doc to an HTTP response.
 * Public (no auth required) per RFC 8414 §3 and OIDC Discovery §4.
 * Served with `Cache-Control: no-store` and CORS `*` so any client can
 * discover the AS configuration without preflight.
 */
export function writeAuthorizationServerMetadataResponse(
  res: ServerResponse,
  doc: AuthorizationServerMetadata,
): void {
  res.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
  });
  res.end(JSON.stringify(doc));
}
