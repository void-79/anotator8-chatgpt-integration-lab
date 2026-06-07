/**
 * Unit tests for the OAuth 2.0 Protected Resource Metadata (RFC 9728) foundation.
 *
 * Covers:
 *   - well-known URL construction (RFC 9728 §3.1)
 *   - inverse mapping from well-known URL to resource identifier (RFC 9728 §3.3)
 *   - metadata document shape (RFC 9728 §2): zero-value params omitted
 *   - WWW-Authenticate challenge format (RFC 9728 §5.1 + RFC 6750 §3)
 *   - loadOAuthConfig() env binding
 *   - isProtectedResourceWellKnownPath() path match
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildBearerChallenge,
  buildProtectedResourceMetadata,
  isProtectedResourceWellKnownPath,
  loadOAuthConfig,
  OAUTH_PROTECTED_RESOURCE_WELL_KNOWN,
  resourceFromWellKnown,
  wellKnownUrlForResource,
  type OAuthFoundationConfig,
} from "../../../src/server/oauth/protected-resource-metadata.js";

describe("wellKnownUrlForResource (RFC 9728 §3.1)", () => {
  it("inserts the well-known suffix for a host-only resource", () => {
    expect(wellKnownUrlForResource("https://example.com")).toBe(
      "https://example.com/.well-known/oauth-protected-resource",
    );
  });

  it("strips the trailing slash for a host/ resource", () => {
    expect(wellKnownUrlForResource("https://example.com/")).toBe(
      "https://example.com/.well-known/oauth-protected-resource",
    );
  });

  it("appends the path after the well-known suffix", () => {
    expect(wellKnownUrlForResource("https://example.com/mcp")).toBe(
      "https://example.com/.well-known/oauth-protected-resource/mcp",
    );
  });

  it("preserves multi-segment paths", () => {
    expect(wellKnownUrlForResource("https://example.com/mcp/v2")).toBe(
      "https://example.com/.well-known/oauth-protected-resource/mcp/v2",
    );
  });

  it("preserves query string", () => {
    expect(wellKnownUrlForResource("https://example.com/mcp?q=1")).toBe(
      "https://example.com/.well-known/oauth-protected-resource/mcp?q=1",
    );
  });

  it("preserves the port", () => {
    expect(wellKnownUrlForResource("http://127.0.0.1:8787/mcp")).toBe(
      "http://127.0.0.1:8787/.well-known/oauth-protected-resource/mcp",
    );
  });

  it("rejects malformed URLs", () => {
    expect(() => wellKnownUrlForResource("not a url")).toThrow();
  });

  it("accepts a custom suffix (for application-specific discovery)", () => {
    expect(wellKnownUrlForResource("https://example.com/mcp", "/.well-known/anotator8-mcp")).toBe(
      "https://example.com/.well-known/anotator8-mcp/mcp",
    );
  });
});

describe("resourceFromWellKnown (RFC 9728 §3.3 inverse)", () => {
  it("recovers a host-only resource from the canonical well-known URL", () => {
    // The resource identifier is what the client used to derive the
    // metadata URL. For the host root, that identifier has no path
    // (no trailing slash). Round-trip with wellKnownUrlForResource().
    expect(
      resourceFromWellKnown("https://example.com/.well-known/oauth-protected-resource"),
    ).toBe("https://example.com");
  });

  it("recovers a /mcp resource", () => {
    expect(
      resourceFromWellKnown("https://example.com/.well-known/oauth-protected-resource/mcp"),
    ).toBe("https://example.com/mcp");
  });

  it("recovers a /mcp/v2 resource with query string", () => {
    expect(
      resourceFromWellKnown(
        "https://example.com/.well-known/oauth-protected-resource/mcp/v2?audience=anotator8",
      ),
    ).toBe("https://example.com/mcp/v2?audience=anotator8");
  });

  it("throws when the URL is not on the well-known path", () => {
    expect(() => resourceFromWellKnown("https://example.com/mcp")).toThrow(/Not a well-known/);
  });
});

describe("buildProtectedResourceMetadata (RFC 9728 §2)", () => {
  const baseConfig: OAuthFoundationConfig = {
    resource: "https://example.com/mcp",
    authorizationServers: [],
    scopesSupported: [],
    bearerMethodsSupported: ["header"],
    resourceName: "Anotator8 Lab",
    resourceDocumentation: undefined,
    includeResourceMetadataInChallenge: true,
  };

  it("always emits the required `resource` field", () => {
    const doc = buildProtectedResourceMetadata(baseConfig);
    expect(doc.resource).toBe("https://example.com/mcp");
  });

  it("omits `authorization_servers` when none configured (RFC 9728 §3.2 zero-value rule)", () => {
    const doc = buildProtectedResourceMetadata(baseConfig);
    expect(doc).not.toHaveProperty("authorization_servers");
  });

  it("emits `authorization_servers` when configured", () => {
    const doc = buildProtectedResourceMetadata({
      ...baseConfig,
      authorizationServers: ["https://as.example.com"],
    });
    expect(doc.authorization_servers).toEqual(["https://as.example.com"]);
  });

  it("omits `scopes_supported` when none configured", () => {
    const doc = buildProtectedResourceMetadata(baseConfig);
    expect(doc).not.toHaveProperty("scopes_supported");
  });

  it("emits `scopes_supported` when configured", () => {
    const doc = buildProtectedResourceMetadata({
      ...baseConfig,
      scopesSupported: ["mcp:read", "mcp:tools"],
    });
    expect(doc.scopes_supported).toEqual(["mcp:read", "mcp:tools"]);
  });

  it("emits `bearer_methods_supported` with the configured subset", () => {
    const doc = buildProtectedResourceMetadata({
      ...baseConfig,
      bearerMethodsSupported: ["header"],
    });
    expect(doc.bearer_methods_supported).toEqual(["header"]);
  });

  it("emits `resource_name` when set", () => {
    const doc = buildProtectedResourceMetadata({ ...baseConfig, resourceName: "My App" });
    expect(doc.resource_name).toBe("My App");
  });

  it("emits `resource_documentation` when set", () => {
    const doc = buildProtectedResourceMetadata({
      ...baseConfig,
      resourceDocumentation: "https://example.com/docs",
    });
    expect(doc.resource_documentation).toBe("https://example.com/docs");
  });
});

describe("buildBearerChallenge (RFC 6750 §3 + RFC 9728 §5.1)", () => {
  it("always emits `realm` quoted", () => {
    const header = buildBearerChallenge({ realm: "anotator8" });
    expect(header).toBe('Bearer realm="anotator8"');
  });

  it("appends `error` and `error_description` when provided", () => {
    const header = buildBearerChallenge({
      realm: "anotator8",
      error: "invalid_token",
      errorDescription: "expired",
    });
    expect(header).toBe('Bearer realm="anotator8", error="invalid_token", error_description="expired"');
  });

  it("appends `scope` when provided", () => {
    const header = buildBearerChallenge({
      realm: "anotator8",
      scope: "mcp:read mcp:tools",
    });
    expect(header).toBe('Bearer realm="anotator8", scope="mcp:read mcp:tools"');
  });

  it("appends `resource_metadata` (RFC 9728 §5.1) when provided", () => {
    const header = buildBearerChallenge({
      realm: "anotator8",
      metadataUrl: "https://example.com/.well-known/oauth-protected-resource/mcp",
    });
    expect(header).toBe(
      'Bearer realm="anotator8", resource_metadata="https://example.com/.well-known/oauth-protected-resource/mcp"',
    );
  });

  it("escapes embedded quotes and backslashes", () => {
    const header = buildBearerChallenge({ realm: 'a"b\\c' });
    expect(header).toBe('Bearer realm="a\\"b\\\\c"');
  });

  it("emits a minimal 401 (no error) when no auth is supplied (RFC 6750 §3 last paragraph)", () => {
    const header = buildBearerChallenge({
      realm: "anotator8",
      metadataUrl: "https://example.com/.well-known/oauth-protected-resource",
    });
    expect(header).toBe(
      'Bearer realm="anotator8", resource_metadata="https://example.com/.well-known/oauth-protected-resource"',
    );
  });
});

describe("isProtectedResourceWellKnownPath", () => {
  it("matches the canonical root path", () => {
    expect(isProtectedResourceWellKnownPath("/.well-known/oauth-protected-resource")).toBe(true);
  });

  it("matches paths with a sub-path appended", () => {
    expect(
      isProtectedResourceWellKnownPath("/.well-known/oauth-protected-resource/mcp"),
    ).toBe(true);
  });

  it("does not match unrelated paths", () => {
    expect(isProtectedResourceWellKnownPath("/mcp")).toBe(false);
    expect(isProtectedResourceWellKnownPath("/.well-known/openid-configuration")).toBe(false);
    expect(isProtectedResourceWellKnownPath("/.well-known/oauth-authorization-server")).toBe(false);
  });

  it("does not match the empty path", () => {
    expect(isProtectedResourceWellKnownPath("")).toBe(false);
    expect(isProtectedResourceWellKnownPath(undefined)).toBe(false);
  });
});

describe("loadOAuthConfig (env binding)", () => {
  const baseEnv = {
    MCP_HOST: "127.0.0.1",
    MCP_PORT: "8787",
  } as const;

  beforeEach(() => {
    for (const key of [
      "MCP_OAUTH_RESOURCE",
      "MCP_OAUTH_AUTHORIZATION_SERVERS",
      "MCP_OAUTH_SCOPES_SUPPORTED",
      "MCP_OAUTH_BEARER_METHODS",
      "MCP_OAUTH_RESOURCE_NAME",
      "MCP_OAUTH_RESOURCE_DOCUMENTATION",
      "MCP_OAUTH_CHALLENGE_INCLUDE_METADATA",
    ]) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("MCP_OAUTH_")) delete process.env[key];
    }
  });

  it("defaults the resource to http://${MCP_HOST}:${MCP_PORT}/mcp", () => {
    const cfg = loadOAuthConfig({ ...baseEnv });
    expect(cfg.resource).toBe("http://127.0.0.1:8787/mcp");
  });

  it("uses the explicit MCP_OAUTH_RESOURCE when set", () => {
    const cfg = loadOAuthConfig({
      ...baseEnv,
      MCP_OAUTH_RESOURCE: "https://public.example.com/mcp",
    });
    expect(cfg.resource).toBe("https://public.example.com/mcp");
  });

  it("parses comma-separated authorization_servers", () => {
    const cfg = loadOAuthConfig({
      ...baseEnv,
      MCP_OAUTH_AUTHORIZATION_SERVERS: "https://as1.example.com, https://as2.example.com",
    });
    expect(cfg.authorizationServers).toEqual([
      "https://as1.example.com",
      "https://as2.example.com",
    ]);
  });

  it("parses comma-separated scopes", () => {
    const cfg = loadOAuthConfig({
      ...baseEnv,
      MCP_OAUTH_SCOPES_SUPPORTED: "mcp:read,mcp:tools",
    });
    expect(cfg.scopesSupported).toEqual(["mcp:read", "mcp:tools"]);
  });

  it("defaults bearer methods to ['header']", () => {
    const cfg = loadOAuthConfig({ ...baseEnv });
    expect(cfg.bearerMethodsSupported).toEqual(["header"]);
  });

  it("filters bearer methods to the RFC 6750 subset", () => {
    const cfg = loadOAuthConfig({
      ...baseEnv,
      MCP_OAUTH_BEARER_METHODS: "header,query,curl,body",
    });
    expect(cfg.bearerMethodsSupported).toEqual(["header", "query", "body"]);
  });

  it("defaults resource name to the server display name", () => {
    const cfg = loadOAuthConfig({ ...baseEnv });
    expect(cfg.resourceName).toBe("Anotator8 ChatGPT Integration Lab");
  });

  it("respects MCP_OAUTH_RESOURCE_NAME override", () => {
    const cfg = loadOAuthConfig({
      ...baseEnv,
      MCP_OAUTH_RESOURCE_NAME: "My Cool App",
    });
    expect(cfg.resourceName).toBe("My Cool App");
  });

  it("defaults includeResourceMetadataInChallenge to true", () => {
    const cfg = loadOAuthConfig({ ...baseEnv });
    expect(cfg.includeResourceMetadataInChallenge).toBe(true);
  });

  it("respects MCP_OAUTH_CHALLENGE_INCLUDE_METADATA=false back-compat", () => {
    const cfg = loadOAuthConfig({
      ...baseEnv,
      MCP_OAUTH_CHALLENGE_INCLUDE_METADATA: "false",
    });
    expect(cfg.includeResourceMetadataInChallenge).toBe(false);
  });
});

describe("constants", () => {
  it("uses the RFC 9728 §8.3.1 well-known suffix", () => {
    expect(OAUTH_PROTECTED_RESOURCE_WELL_KNOWN).toBe("/.well-known/oauth-protected-resource");
  });
});
