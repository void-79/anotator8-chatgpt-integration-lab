/**
 * End-to-end tests for the OAuth 2.0 Protected Resource Metadata
 * foundation. These tests actually start `createHttpMcpApp()`, send
 * real HTTP requests, and assert the responses match RFC 9728 and
 * RFC 6750.
 *
 * Coverage:
 *   - GET /.well-known/oauth-protected-resource returns the host-root
 *     resource metadata (200, application/json, cache-control: no-store)
 *   - GET /.well-known/oauth-protected-resource/mcp returns the /mcp
 *     resource metadata; `resource` field equals the request path's
 *     resource identifier (RFC 9728 §3.3)
 *   - 401 on /mcp with bearer required now also exposes
 *     `WWW-Authenticate: Bearer resource_metadata=...` (RFC 9728 §5.1)
 *   - 403 on /mcp with wrong bearer exposes the same
 *   - GET on other paths still 404
 *   - env override: when MCP_OAUTH_AUTHORIZATION_SERVERS is set, the
 *     metadata document includes it
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHttpMcpApp } from "../../../src/server/app.js";
import {
  loadOAuthConfig,
  wellKnownUrlForResource,
  type OAuthFoundationConfig,
} from "../../../src/server/oauth/protected-resource-metadata.js";

interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers?: string[];
  scopes_supported?: string[];
  bearer_methods_supported?: string[];
  resource_name?: string;
  resource_documentation?: string;
}

describe("OAuth 2.0 Protected Resource Metadata — RFC 9728", () => {
  let baseUrl = "";
  let httpServer: ReturnType<typeof createHttpMcpApp>["httpServer"];
  let transports: ReturnType<typeof createHttpMcpApp>["transports"];

  beforeAll(async () => {
    process.env.MCP_AUTH_TOKEN = "test-bearer-abc-123";
    process.env.MCP_OAUTH_AUTHORIZATION_SERVERS = "https://as.example.com,https://as2.example.com";
    process.env.MCP_OAUTH_SCOPES_SUPPORTED = "mcp:read,mcp:tools";
    process.env.MCP_OAUTH_RESOURCE_NAME = "Anotator8 ChatGPT Integration Lab (test)";
    process.env.MCP_OAUTH_RESOURCE_DOCUMENTATION = "https://example.com/docs";

    const app = createHttpMcpApp();
    httpServer = app.httpServer;
    transports = app.transports;
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const addr = httpServer.address();
    if (!addr || typeof addr === "string") throw new Error("Could not bind ephemeral port");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    for (const session of transports.values()) {
      await session.transport.close();
      await session.server.close();
    }
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    delete process.env.MCP_AUTH_TOKEN;
    delete process.env.MCP_OAUTH_AUTHORIZATION_SERVERS;
    delete process.env.MCP_OAUTH_SCOPES_SUPPORTED;
    delete process.env.MCP_OAUTH_RESOURCE_NAME;
    delete process.env.MCP_OAUTH_RESOURCE_DOCUMENTATION;
  });

  it("GET /.well-known/oauth-protected-resource returns 200 with host-root metadata", async () => {
    const res = await fetch(`${baseUrl}/.well-known/oauth-protected-resource`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const doc = (await res.json()) as ProtectedResourceMetadata;
    // For the host-root form, the resource identifier is the origin
    // with no path component (RFC 3986 normalization: "https://host"
    // and "https://host/" are equivalent; we emit the no-slash form to
    // round-trip with wellKnownUrlForResource()).
    expect(doc.resource).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  });

  it("GET /.well-known/oauth-protected-resource/mcp returns the /mcp resource metadata", async () => {
    const res = await fetch(`${baseUrl}/.well-known/oauth-protected-resource/mcp`);
    expect(res.status).toBe(200);
    const doc = (await res.json()) as ProtectedResourceMetadata;
    // Per RFC 9728 §3.3 the `resource` value MUST match the URL the
    // client used to derive the metadata URL. The client asked for
    // /mcp, so the resource field must end with /mcp.
    expect(doc.resource).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/mcp$/);
  });

  it("metadata includes the configured authorization_servers, scopes, and bearer_methods", async () => {
    const res = await fetch(`${baseUrl}/.well-known/oauth-protected-resource/mcp`);
    const doc = (await res.json()) as ProtectedResourceMetadata;
    expect(doc.authorization_servers).toEqual([
      "https://as.example.com",
      "https://as2.example.com",
    ]);
    expect(doc.scopes_supported).toEqual(["mcp:read", "mcp:tools"]);
    expect(doc.bearer_methods_supported).toEqual(["header"]);
    expect(doc.resource_name).toBe("Anotator8 ChatGPT Integration Lab (test)");
    expect(doc.resource_documentation).toBe("https://example.com/docs");
  });

  it("metadata CORS allows any origin (public discovery)", async () => {
    const res = await fetch(`${baseUrl}/.well-known/oauth-protected-resource/mcp`, {
      headers: { origin: "https://chatgpt.com" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("the 401 on /mcp also carries resource_metadata= (RFC 9728 §5.1)", async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(res.status).toBe(401);
    const challenge = res.headers.get("www-authenticate") ?? "";
    expect(challenge).toMatch(/^Bearer realm="anotator8-chatgpt-lab"/);
    expect(challenge).toMatch(/resource_metadata="http:\/\/127\.0\.0\.1:\d+\/.well-known\/oauth-protected-resource\/mcp"/);
    expect(challenge).toMatch(/error="invalid_request"/);
  });

  it("the 403 on /mcp with wrong bearer also carries resource_metadata=", async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: "Bearer wrong-token",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(res.status).toBe(403);
    const challenge = res.headers.get("www-authenticate") ?? "";
    expect(challenge).toMatch(/^Bearer realm="anotator8-chatgpt-lab"/);
    expect(challenge).toMatch(/resource_metadata=/);
    expect(challenge).toMatch(/error="invalid_token"/);
  });

  it("non-GET on the well-known path returns 404 (only GET is allowed per RFC 9728 §3.1)", async () => {
    const res = await fetch(`${baseUrl}/.well-known/oauth-protected-resource/mcp`, {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });

  it("unknown paths still 404 (well-known does not affect routing)", async () => {
    const res = await fetch(`${baseUrl}/not-a-real-path`);
    expect(res.status).toBe(404);
  });
});

describe("OAuth 2.0 Protected Resource Metadata — back-compat", () => {
  let baseUrl = "";
  let httpServer: ReturnType<typeof createHttpMcpApp>["httpServer"];
  let transports: ReturnType<typeof createHttpMcpApp>["transports"];

  beforeAll(async () => {
    process.env.MCP_AUTH_TOKEN = "back-compat-token";
    process.env.MCP_OAUTH_CHALLENGE_INCLUDE_METADATA = "false";

    const app = createHttpMcpApp();
    httpServer = app.httpServer;
    transports = app.transports;
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const addr = httpServer.address();
    if (!addr || typeof addr === "string") throw new Error("Could not bind ephemeral port");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    for (const session of transports.values()) {
      await session.transport.close();
      await session.server.close();
    }
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    delete process.env.MCP_AUTH_TOKEN;
    delete process.env.MCP_OAUTH_CHALLENGE_INCLUDE_METADATA;
  });

  it("with MCP_OAUTH_CHALLENGE_INCLUDE_METADATA=false, the 401 challenge omits resource_metadata", async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(res.status).toBe(401);
    const challenge = res.headers.get("www-authenticate") ?? "";
    expect(challenge).toMatch(/^Bearer realm="anotator8-chatgpt-lab"/);
    expect(challenge).not.toMatch(/resource_metadata=/);
  });
});

describe("wellKnownUrlForResource defaults", () => {
  it("computes a stable well-known URL from a base resource", () => {
    const resource = "https://example.com/mcp";
    const url = wellKnownUrlForResource(resource);
    expect(url).toBe("https://example.com/.well-known/oauth-protected-resource/mcp");
  });

  it("loadOAuthConfig() default resource is derived from MCP_HOST/PORT", () => {
    const cfg: OAuthFoundationConfig = loadOAuthConfig({
      MCP_HOST: "10.0.0.1",
      MCP_PORT: "9000",
    });
    expect(cfg.resource).toBe("http://10.0.0.1:9000/mcp");
    const url = wellKnownUrlForResource(cfg.resource);
    expect(url).toBe("http://10.0.0.1:9000/.well-known/oauth-protected-resource/mcp");
  });
});
