/**
 * OAuth 2.0 Protected Resource Metadata — RFC 9728 foundation.
 *
 * Scope of this module:
 *   - Build a protected-resource metadata JSON document (RFC 9728 §2).
 *   - Compute the well-known URL for the metadata (RFC 9728 §3.1).
 *   - Build the `WWW-Authenticate` challenge string that points clients
 *     at the metadata URL on 401 responses (RFC 9728 §5.1).
 *
 * Scope explicitly NOT covered here (deferred to follow-up work):
 *   - Actual OAuth 2.1 authorization-server implementation.
 *   - Token validation against a real introspection endpoint or JWKS.
 *   - Per-tool scope enforcement.
 *   - DPoP / mTLS / authorization_details flows.
 *
 * The lab today still validates a static `MCP_AUTH_TOKEN`; this module
 * only ADDS discovery. Existing tests that assert the legacy 401 header
 * `Bearer realm="..."` continue to pass because the legacy realm is
 * preserved and `resource_metadata` is appended.
 *
 * Spec references:
 *   - RFC 9728 (April 2025) — https://www.rfc-editor.org/rfc/rfc9728
 *   - RFC 6750 (October 2012) — https://www.rfc-editor.org/rfc/rfc6750
 *   - RFC 8414 (OAuth 2.0 Authorization Server Metadata)
 */

import type { ServerResponse } from "node:http";

/** Well-known path suffix for protected resource metadata (RFC 9728 §8.3.1). */
export const OAUTH_PROTECTED_RESOURCE_WELL_KNOWN =
  "/.well-known/oauth-protected-resource";

/** Bearer methods defined by RFC 6750 §2. */
export const OAUTH_BEARER_METHODS = ["header", "body", "query"] as const;
export type OAuthBearerMethod = (typeof OAUTH_BEARER_METHODS)[number];

/**
 * Subset of RFC 9728 §2 metadata parameters that this lab actually
 * publishes. Anything not exposed here is OPTIONAL and is intentionally
 * omitted to keep the surface minimal.
 */
export interface ProtectedResourceMetadata {
  /** REQUIRED — RFC 9728 §2. The protected resource's resource identifier. */
  readonly resource: string;
  /** OPTIONAL — RFC 9728 §2. */
  readonly authorization_servers?: ReadonlyArray<string>;
  /** RECOMMENDED — RFC 9728 §2. */
  readonly scopes_supported?: ReadonlyArray<string>;
  /** OPTIONAL — RFC 9728 §2. */
  readonly bearer_methods_supported?: ReadonlyArray<OAuthBearerMethod>;
  /** OPTIONAL — RFC 9728 §2. Display name. */
  readonly resource_name?: string;
  /** OPTIONAL — RFC 9728 §2. */
  readonly resource_documentation?: string;
}

/**
 * Configuration for the OAuth foundation. All fields are sourced from
 * environment variables in `loadOAuthConfig()` below. Tests construct
 * this object directly to keep the env boundary explicit.
 */
export interface OAuthFoundationConfig {
  /** Public resource identifier. e.g. "https://example.com/mcp". */
  readonly resource: string;
  /** Authorization server issuer identifiers. Omitted from doc when empty. */
  readonly authorizationServers: ReadonlyArray<string>;
  /** Scopes the resource server is willing to disclose. */
  readonly scopesSupported: ReadonlyArray<string>;
  /** Bearer methods supported. Defaults to `["header"]` (RFC 6750 §2.1). */
  readonly bearerMethodsSupported: ReadonlyArray<OAuthBearerMethod>;
  /** Display name. Defaults to the SERVER_NAME. */
  readonly resourceName: string;
  /** Resource documentation URL. Optional. */
  readonly resourceDocumentation: string | undefined;
  /**
   * When false, the well-known endpoint is still served (it's discoverable
   * metadata) but the 401 `WWW-Authenticate` header does NOT include
   * `resource_metadata`. This is a back-compat escape hatch.
   * Default true.
   */
  readonly includeResourceMetadataInChallenge: boolean;
}

/**
 * Build a `ProtectedResourceMetadata` document from a config. Parameters
 * with zero values are omitted (RFC 9728 §3.2 "Parameters with zero
 * values MUST be omitted from the response").
 */
export function buildProtectedResourceMetadata(
  config: OAuthFoundationConfig,
): ProtectedResourceMetadata {
  const doc: ProtectedResourceMetadata = { resource: config.resource };
  if (config.authorizationServers.length > 0) {
    (doc as { authorization_servers?: ReadonlyArray<string> }).authorization_servers =
      config.authorizationServers;
  }
  if (config.scopesSupported.length > 0) {
    (doc as { scopes_supported?: ReadonlyArray<string> }).scopes_supported =
      config.scopesSupported;
  }
  if (config.bearerMethodsSupported.length > 0) {
    (doc as { bearer_methods_supported?: ReadonlyArray<OAuthBearerMethod> }).bearer_methods_supported =
      config.bearerMethodsSupported;
  }
  if (config.resourceName) {
    (doc as { resource_name?: string }).resource_name = config.resourceName;
  }
  if (config.resourceDocumentation) {
    (doc as { resource_documentation?: string }).resource_documentation =
      config.resourceDocumentation;
  }
  return doc;
}

/**
 * Compute the well-known metadata URL for a given resource identifier,
 * per RFC 9728 §3.1:
 *
 *   1. Parse the resource URL.
 *   2. Strip any terminating slash after the host.
 *   3. Insert `/.well-known/<suffix>` between the host and the path.
 *
 * Examples:
 *   https://example.com               -> https://example.com/.well-known/oauth-protected-resource
 *   https://example.com/              -> https://example.com/.well-known/oauth-protected-resource
 *   https://example.com/mcp           -> https://example.com/.well-known/oauth-protected-resource/mcp
 *   https://example.com/mcp/v2        -> https://example.com/.well-known/oauth-protected-resource/mcp/v2
 *   https://example.com/mcp?q=1       -> https://example.com/.well-known/oauth-protected-resource/mcp?q=1
 */
export function wellKnownUrlForResource(resource: string, suffix = OAUTH_PROTECTED_RESOURCE_WELL_KNOWN): string {
  // Throws on a malformed URL — caller (loadOAuthConfig) is expected to
  // validate first. The thrown TypeError is informative enough.
  const parsed = new URL(resource);
  const pathAndQuery = `${parsed.pathname.replace(/\/$/, "")}${parsed.search}`;
  return `${parsed.protocol}//${parsed.host}${suffix}${pathAndQuery}`;
}

/**
 * Inverse helper — given a well-known metadata URL, return the resource
 * identifier it describes. Used by tests and by the integration test
 * that fetches metadata and validates the `resource` field matches
 * (RFC 9728 §3.3 impersonation check).
 */
export function resourceFromWellKnown(metadataUrl: string, suffix = OAUTH_PROTECTED_RESOURCE_WELL_KNOWN): string {
  const parsed = new URL(metadataUrl);
  if (!parsed.pathname.startsWith(suffix)) {
    throw new Error(`Not a well-known oauth-protected-resource URL: ${metadataUrl}`);
  }
  const rest = parsed.pathname.slice(suffix.length);
  const path = rest; // empty means root resource
  return `${parsed.protocol}//${parsed.host}${path}${parsed.search}`;
}

/**
 * Build a `WWW-Authenticate` header value per RFC 6750 §3 + RFC 9728
 * §5.1. The `resource_metadata` parameter is the well-known URL; the
 * `realm` is the existing lab realm.
 *
 * Quoting follows RFC 7235 §2.2 / RFC 9110 §11.6.1: token values that
 * contain anything outside the `auth-param` token grammar are quoted
 * with double quotes, and embedded double quotes / backslashes are
 * escaped with backslash.
 */
export function buildBearerChallenge(options: {
  realm: string;
  metadataUrl?: string | undefined;
  error?: "invalid_request" | "invalid_token" | "insufficient_scope" | undefined;
  errorDescription?: string | undefined;
  scope?: string | undefined;
}): string {
  const parts: string[] = [`realm="${escapeQuoted(options.realm)}"`];
  if (options.error) parts.push(`error="${escapeQuoted(options.error)}"`);
  if (options.errorDescription) {
    parts.push(`error_description="${escapeQuoted(options.errorDescription)}"`);
  }
  if (options.scope) {
    parts.push(`scope="${escapeQuoted(options.scope)}"`);
  }
  if (options.metadataUrl) {
    parts.push(`resource_metadata="${escapeQuoted(options.metadataUrl)}"`);
  }
  return `Bearer ${parts.join(", ")}`;
}

/** Escape a string for inclusion inside an HTTP `auth-param` quoted value. */
function escapeQuoted(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Load the OAuth foundation config from `process.env`. Designed to be
 * called once at server startup; the returned object is what the rest
 * of the app uses.
 *
 * Env vars (all optional except the implicit defaults):
 *   MCP_OAUTH_RESOURCE                 resource identifier (default http://${MCP_HOST}:${MCP_PORT}/mcp)
 *   MCP_OAUTH_AUTHORIZATION_SERVERS    comma-separated issuer URLs
 *   MCP_OAUTH_SCOPES_SUPPORTED         comma-separated scope values
 *   MCP_OAUTH_BEARER_METHODS           comma-separated subset of {header,body,query}
 *   MCP_OAUTH_RESOURCE_NAME            display name (default: server name)
 *   MCP_OAUTH_RESOURCE_DOCUMENTATION   URL
 *   MCP_OAUTH_CHALLENGE_INCLUDE_METADATA  "false" disables the resource_metadata param
 */
export function loadOAuthConfig(env: NodeJS.ProcessEnv = process.env): OAuthFoundationConfig {
  const host = env.MCP_HOST ?? "127.0.0.1";
  const port = env.MCP_PORT ?? "8787";
  const resource =
    env.MCP_OAUTH_RESOURCE?.trim() || `http://${host}:${port}/mcp`;

  const authorizationServers = splitCsv(env.MCP_OAUTH_AUTHORIZATION_SERVERS);
  const scopesSupported = splitCsv(env.MCP_OAUTH_SCOPES_SUPPORTED);
  const bearerMethodsRaw = splitCsv(env.MCP_OAUTH_BEARER_METHODS, ["header"]);
  const bearerMethodsSupported = bearerMethodsRaw.filter((m): m is OAuthBearerMethod =>
    (OAUTH_BEARER_METHODS as ReadonlyArray<string>).includes(m),
  );

  const includeResourceMetadataInChallenge =
    (env.MCP_OAUTH_CHALLENGE_INCLUDE_METADATA ?? "true").toLowerCase() !== "false";

  return {
    resource,
    authorizationServers,
    scopesSupported,
    bearerMethodsSupported,
    resourceName: env.MCP_OAUTH_RESOURCE_NAME?.trim() || "Anotator8 ChatGPT Integration Lab",
    resourceDocumentation: env.MCP_OAUTH_RESOURCE_DOCUMENTATION?.trim() || undefined,
    includeResourceMetadataInChallenge,
  };
}

function splitCsv(raw: string | undefined, fallback: ReadonlyArray<string> = []): string[] {
  if (!raw?.trim()) return [...fallback];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Write the metadata document to an HTTP response. The response is
 * served at the well-known path with `application/json` content type
 * and `Cache-Control: no-store` (RFC 9728 §7.10 recommends clients
 * revalidate, and metadata may change — e.g. when AS list is rotated).
 */
export function writeProtectedResourceMetadataResponse(
  res: ServerResponse,
  doc: ProtectedResourceMetadata,
): void {
  res.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    // The metadata is public; allow any browser to read it (no CORS
    // preflight needed for a simple GET).
    "access-control-allow-origin": "*",
  });
  res.end(JSON.stringify(doc));
}

/**
 * The two path shapes the lab serves for the well-known endpoint.
 * For a resource of `http://host:port/mcp` the canonical path is
 * `/.well-known/oauth-protected-resource/mcp`. We also serve the
 * `/.well-known/oauth-protected-resource` root form so a client
 * performing host-only discovery gets a valid document.
 */
export function isProtectedResourceWellKnownPath(url: string | undefined): boolean {
  if (!url) return false;
  return (
    url === OAUTH_PROTECTED_RESOURCE_WELL_KNOWN ||
    url.startsWith(`${OAUTH_PROTECTED_RESOURCE_WELL_KNOWN}/`)
  );
}
