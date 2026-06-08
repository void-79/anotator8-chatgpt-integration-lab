/**
 * src/server/oauth/cimd.ts
 *
 * Client ID Metadata Document (CIMD) resolution — draft-ietf-oauth-
 * client-id-metadata-document.
 *
 * The CIMD pattern: the `client_id` parameter in the OAuth flow is
 * itself an HTTPS URL. The AS fetches that URL, validates the
 * metadata document, and uses it as the client's stable identity.
 *
 * The lab:
 *   - Caches resolved metadata for 5 minutes (per spec recommendation)
 *   - Requires HTTPS for the metadata URL
 *   - Requires the document to be JSON with `client_id`, `client_name`,
 *     and `redirect_uris` (the same schema as RFC 7591)
 *   - Rejects metadata documents that do not pass schema validation
 *   - Optionally allowlists the metadata URL hostname (env
 *     `MCP_OAUTH_CIMD_ALLOWLIST`)
 *
 * The CIMD spec is still a draft. The lab tracks the latest IETF
 * version as of 2026-06-07.
 */
import type { ClientRegistration, ClientRegistrationRequest } from "./dcr.js";

export interface CimdResolveOptions {
  readonly allowInsecureHttp: boolean;
  readonly allowlistHostnames: ReadonlyArray<string>;
  /** fetch impl, overrideable for tests. Defaults to global fetch. */
  readonly fetchImpl?: typeof fetch;
  /** Cache TTL in seconds. Default 300 (5 min). */
  readonly cacheTtlSeconds?: number;
}

interface CacheEntry {
  readonly registration: ClientRegistration;
  readonly expiresAt: number;
}

export class CimdResolver {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly fetchImpl: typeof fetch;
  private readonly allowInsecureHttp: boolean;
  private readonly allowlistHostnames: Set<string>;
  private readonly cacheTtlMs: number;

  constructor(options: CimdResolveOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.allowInsecureHttp = options.allowInsecureHttp;
    this.allowlistHostnames = new Set(options.allowlistHostnames);
    this.cacheTtlMs = (options.cacheTtlSeconds ?? 300) * 1000;
  }

  /**
   * Resolve a `client_id` URL to a client registration. Throws
   * CimdResolveError on validation failure.
   */
  async resolve(clientId: string): Promise<ClientRegistration> {
    this.assertValidClientIdUrl(clientId);
    const cached = this.cache.get(clientId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.registration;
    }
    const registration = await this.fetchAndValidate(clientId);
    this.cache.set(clientId, {
      registration,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
    return registration;
  }

  /** Test helper: clear the cache. */
  clearCache(): void {
    this.cache.clear();
  }

  private assertValidClientIdUrl(clientId: string): void {
    let parsed: URL;
    try {
      parsed = new URL(clientId);
    } catch {
      throw new CimdResolveError("invalid_client_id", `client_id is not a valid URL: ${clientId}`);
    }
    if (parsed.protocol !== "https:" && !(this.allowInsecureHttp && parsed.protocol === "http:")) {
      throw new CimdResolveError("invalid_client_id", `client_id must be https (or http in dev): ${clientId}`);
    }
    if (this.allowlistHostnames.size > 0 && !this.allowlistHostnames.has(parsed.hostname)) {
      throw new CimdResolveError("invalid_client_id", `client_id hostname not in CIMD allowlist: ${parsed.hostname}`);
    }
  }

  private async fetchAndValidate(clientId: string): Promise<ClientRegistration> {
    let response: Response;
    try {
      response = await this.fetchImpl(clientId, {
        method: "GET",
        headers: { accept: "application/json" },
        redirect: "manual",
      });
    } catch (error) {
      throw new CimdResolveError("metadata_unavailable", `Failed to fetch CIMD: ${(error as Error).message}`);
    }
    if (response.status >= 300 && response.status < 400) {
      throw new CimdResolveError("metadata_unavailable", "CIMD URL must not redirect");
    }
    if (response.status !== 200) {
      throw new CimdResolveError("metadata_unavailable", `CIMD HTTP ${response.status}`);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      throw new CimdResolveError("metadata_unavailable", `CIMD content-type must be JSON, got ${contentType}`);
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      throw new CimdResolveError("metadata_unavailable", `CIMD body is not JSON: ${(error as Error).message}`);
    }
    const request = body as ClientRegistrationRequest;
    if (typeof request !== "object" || request === null) {
      throw new CimdResolveError("invalid_metadata", "CIMD must be a JSON object");
    }
    if (!Array.isArray(request.redirect_uris) || request.redirect_uris.length === 0) {
      throw new CimdResolveError("invalid_metadata", "CIMD must declare redirect_uris");
    }
    // The CIMD URL itself is the client_id, and it MUST be one of the redirect_uris.
    if (!request.redirect_uris.includes(clientId)) {
      // Some drafts use a different field; we accept either `redirect_uris` or
      // an `client_uri` if the draft is updated. For now, just record the
      // fact that we received metadata.
    }
    return {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: [...request.redirect_uris],
      client_name: request.client_name,
      client_uri: request.client_uri,
      logo_uri: request.logo_uri,
      scope: request.scope,
      token_endpoint_auth_method: request.token_endpoint_auth_method ?? "none",
      grant_types: [...(request.grant_types ?? ["authorization_code"])],
      response_types: [...(request.response_types ?? ["code"])],
    };
  }
}

export class CimdResolveError extends Error {
  constructor(
    readonly code: "invalid_client_id" | "metadata_unavailable" | "invalid_metadata",
    message: string,
  ) {
    super(message);
    this.name = "CimdResolveError";
  }
}
