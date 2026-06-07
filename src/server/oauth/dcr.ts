/**
 * src/server/oauth/dcr.ts
 *
 * Dynamic Client Registration — RFC 7591. Minimal subset:
 *   - Accepts the application/json content type
 *   - Validates redirect_uris (must be HTTPS unless `allowInsecureHttp`)
 *   - Generates a client_id (opaque UUID)
 *   - Optionally generates a client_secret (we don't, because the lab
 *     supports `token_endpoint_auth_methods_supported: ["none", ...]`
 *     for public clients; see OpenAI Apps SDK Auth § "Client registration")
 *   - Stores the client registration in an in-memory map; lost on restart
 *
 * This is a fallback for environments where CIMD (preferred) is not
 * available. The lab always advertises CIMD support; the
 * connector creator chooses CIMD or DCR.
 */
import { randomUUID } from "node:crypto";

export interface ClientRegistrationRequest {
  readonly redirect_uris: ReadonlyArray<string>;
  readonly client_name?: string;
  readonly client_uri?: string;
  readonly logo_uri?: string;
  readonly scope?: string;
  readonly token_endpoint_auth_method?: "none" | "client_secret_basic" | "client_secret_post";
  readonly grant_types?: ReadonlyArray<string>;
  readonly response_types?: ReadonlyArray<string>;
}

export interface ClientRegistration {
  readonly client_id: string;
  readonly client_id_issued_at: number;
  readonly redirect_uris: ReadonlyArray<string>;
  readonly client_name?: string;
  readonly client_uri?: string;
  readonly logo_uri?: string;
  readonly scope?: string;
  readonly token_endpoint_auth_method: "none" | "client_secret_basic" | "client_secret_post";
  readonly grant_types: ReadonlyArray<string>;
  readonly response_types: ReadonlyArray<string>;
}

export class DcrValidationError extends Error {
  constructor(readonly code: "invalid_redirect_uri" | "invalid_client_metadata", message: string) {
    super(message);
    this.name = "DcrValidationError";
  }
}

export class ClientRegistry {
  private readonly clients = new Map<string, ClientRegistration>();
  private readonly allowInsecureHttp: boolean;

  constructor(options: { allowInsecureHttp?: boolean } = {}) {
    this.allowInsecureHttp = options.allowInsecureHttp ?? true;
  }

  /** Validate a registration request and return a registered client. */
  register(request: ClientRegistrationRequest): ClientRegistration {
    if (!Array.isArray(request.redirect_uris) || request.redirect_uris.length === 0) {
      throw new DcrValidationError("invalid_redirect_uri", "redirect_uris is required and must be a non-empty array");
    }
    for (const uri of request.redirect_uris) {
      this.validateRedirectUri(uri);
    }
    const grantTypes = request.grant_types ?? ["authorization_code"];
    if (!grantTypes.includes("authorization_code")) {
      throw new DcrValidationError("invalid_client_metadata", "Only authorization_code grant is supported");
    }
    const responseTypes = request.response_types ?? ["code"];
    if (!responseTypes.every((rt) => rt === "code")) {
      throw new DcrValidationError("invalid_client_metadata", "Only response_type=code is supported");
    }
    const registration: ClientRegistration = {
      client_id: randomUUID(),
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: [...request.redirect_uris],
      client_name: request.client_name,
      client_uri: request.client_uri,
      logo_uri: request.logo_uri,
      scope: request.scope,
      token_endpoint_auth_method: request.token_endpoint_auth_method ?? "none",
      grant_types: [...grantTypes],
      response_types: [...responseTypes],
    };
    this.clients.set(registration.client_id, registration);
    return registration;
  }

  /** Look up a previously registered client. Returns null if unknown. */
  get(clientId: string): ClientRegistration | null {
    return this.clients.get(clientId) ?? null;
  }

  /** Test helper. */
  size(): number {
    return this.clients.size;
  }

  private validateRedirectUri(uri: string): void {
    let parsed: URL;
    try {
      parsed = new URL(uri);
    } catch {
      throw new DcrValidationError("invalid_redirect_uri", `Not a valid URL: ${uri}`);
    }
    if (parsed.protocol !== "https:" && !(this.allowInsecureHttp && parsed.protocol === "http:")) {
      throw new DcrValidationError("invalid_redirect_uri", `redirect_uri must be https (or http in dev): ${uri}`);
    }
    if (parsed.hash) {
      throw new DcrValidationError("invalid_redirect_uri", "redirect_uri must not contain a fragment");
    }
  }
}
