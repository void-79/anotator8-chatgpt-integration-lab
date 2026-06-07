import { describe, expect, it } from "vitest";
import {
  AUTHORIZE_PATH,
  JWKS_PATH,
  OIDC_DISCOVERY_WELL_KNOWN,
  OAUTH_AUTHORIZATION_SERVER_WELL_KNOWN,
  REGISTER_PATH,
  TOKEN_PATH,
  buildAuthorizationServerMetadata,
  isAuthorizationServerWellKnownPath,
  loadAuthorizationServerConfig,
} from "../../../src/server/oauth/authorization-server-metadata.js";

describe("oauth/authorization-server-metadata — RFC 8414", () => {
  it("loadAuthorizationServerConfig derives a sensible default issuer", () => {
    const env = { MCP_HOST: "127.0.0.1", MCP_PORT: "9000" } as NodeJS.ProcessEnv;
    const cfg = loadAuthorizationServerConfig(env);
    expect(cfg.issuer).toBe("http://127.0.0.1:9000");
    expect(cfg.scopesSupported).toEqual(["mcp:read"]);
    expect(cfg.cimdSupported).toBe(true);
    expect(cfg.allowInsecureHttp).toBe(true);
  });

  it("loadAuthorizationServerConfig honors explicit MCP_OAUTH_ISSUER (trailing slash stripped at metadata build time)", () => {
    const env = { MCP_OAUTH_ISSUER: "https://as.example.com/" } as NodeJS.ProcessEnv;
    const cfg = loadAuthorizationServerConfig(env);
    // The config preserves the trailing slash; the strip happens when
    // buildAuthorizationServerMetadata constructs endpoint URLs.
    expect(cfg.issuer).toBe("https://as.example.com/");
    const doc = buildAuthorizationServerMetadata(cfg);
    expect(doc.issuer).toBe("https://as.example.com");
    expect(doc.authorization_endpoint).toBe("https://as.example.com/oauth2/v1/authorize");
  });

  it("loadAuthorizationServerConfig splits CSV scopes", () => {
    const env = { MCP_OAUTH_SCOPES_SUPPORTED: "mcp:read, mcp:write, mcp:admin" } as NodeJS.ProcessEnv;
    const cfg = loadAuthorizationServerConfig(env);
    expect(cfg.scopesSupported).toEqual(["mcp:read", "mcp:write", "mcp:admin"]);
  });

  it("loadAuthorizationServerConfig can disable CIMD", () => {
    const env = { MCP_OAUTH_CIMD_SUPPORTED: "false" } as NodeJS.ProcessEnv;
    const cfg = loadAuthorizationServerConfig(env);
    expect(cfg.cimdSupported).toBe(false);
  });

  it("buildAuthorizationServerMetadata produces an RFC 8414 doc", () => {
    const cfg = loadAuthorizationServerConfig({ MCP_OAUTH_ISSUER: "https://as.example.com" } as NodeJS.ProcessEnv);
    const doc = buildAuthorizationServerMetadata(cfg);
    expect(doc.issuer).toBe("https://as.example.com");
    expect(doc.authorization_endpoint).toBe(`https://as.example.com${AUTHORIZE_PATH}`);
    expect(doc.token_endpoint).toBe(`https://as.example.com${TOKEN_PATH}`);
    expect((doc as { jwks_uri: string }).jwks_uri).toBe(`https://as.example.com${JWKS_PATH}`);
    expect((doc as { registration_endpoint: string }).registration_endpoint).toBe(`https://as.example.com${REGISTER_PATH}`);
    expect(doc.response_types_supported).toEqual(["code"]);
    expect(doc.grant_types_supported).toEqual(["authorization_code"]);
    expect(doc.code_challenge_methods_supported).toEqual(["S256"]);
    expect(doc.client_id_metadata_document_supported).toBe(true);
    expect(doc.scopes_supported).toEqual(["mcp:read"]);
  });

  it("buildAuthorizationServerMetadata omits optional fields when none", () => {
    const doc = buildAuthorizationServerMetadata({
      issuer: "http://127.0.0.1:9000",
      scopesSupported: [],
      cimdSupported: false,
      allowInsecureHttp: true,
    });
    expect(doc.scopes_supported).toBeUndefined();
    expect(doc.client_id_metadata_document_supported).toBeUndefined();
  });

  it("isAuthorizationServerWellKnownPath matches both RFC 8414 and OIDC paths", () => {
    expect(isAuthorizationServerWellKnownPath(OAUTH_AUTHORIZATION_SERVER_WELL_KNOWN)).toBe(true);
    expect(isAuthorizationServerWellKnownPath(OIDC_DISCOVERY_WELL_KNOWN)).toBe(true);
    expect(isAuthorizationServerWellKnownPath("/.well-known/oauth-protected-resource")).toBe(false);
    expect(isAuthorizationServerWellKnownPath(undefined)).toBe(false);
    expect(isAuthorizationServerWellKnownPath("/.well-known/oauth-authorization-server?foo=bar")).toBe(true);
  });
});
