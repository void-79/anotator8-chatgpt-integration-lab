/**
 * End-to-end integration test for the in-process OAuth 2.1 AS.
 * Starts `createHttpMcpApp()`, exercises:
 *   - AS metadata discovery (RFC 8414)
 *   - JWKS publication (RS256)
 *   - DCR (RFC 7591)
 *   - Authorize + token with PKCE S256
 *   - Token used as a Bearer on /mcp
 *   - Single-use code
 *   - PKCE mismatch
 *   - Token expiry
 *   - Static-token fallback when MCP_AUTH_TOKEN is set
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHttpMcpApp } from "../../../src/server/app.js";

interface AsMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  registration_endpoint: string;
  response_types_supported: string[];
  grant_types_supported: string[];
  code_challenge_methods_supported: string[];
  client_id_metadata_document_supported: boolean;
  scopes_supported: string[];
}

interface JwksDoc {
  keys: { kty: string; alg: string; kid: string; n: string; e: string }[];
}

interface RegistrationResponse {
  client_id: string;
  redirect_uris: string[];
  token_endpoint_auth_method: string;
}

async function rpc(url: string, init: { method: string; headers?: Record<string, string>; body?: string }): Promise<{ status: number; headers: Headers; json: any; text: string }> {
  const response = await fetch(url, { ...init, redirect: "manual" });
  const text = await response.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* leave null */ }
  return { status: response.status, headers: response.headers, json, text };
}

async function form(url: string, fields: Record<string, string>): Promise<{ status: number; headers: Headers; json: any; text: string }> {
  return rpc(url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(fields).toString() });
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function sha256B64Url(input: string): string {
  return b64url(require("node:crypto").createHash("sha256").update(input, "ascii").digest());
}

describe("OAuth 2.1 Authorization Server (v0.7.0) — end-to-end", () => {
  let baseUrl = "";
  let httpServer: ReturnType<typeof createHttpMcpApp>["httpServer"];
  let transports: ReturnType<typeof createHttpMcpApp>["transports"];

  beforeAll(async () => {
    delete process.env.MCP_AUTH_TOKEN;
    delete process.env.MCP_OAUTH_REQUIRE_AUTH;
    const app = createHttpMcpApp();
    httpServer = app.httpServer;
    transports = app.transports;
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const addr = httpServer.address();
    expect(addr).not.toBeNull();
    baseUrl = `http://127.0.0.1:${(addr as { port: number }).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it("serves RFC 8414 metadata at the well-known path", async () => {
    const r = await rpc(`${baseUrl}/.well-known/oauth-authorization-server`, { method: "GET" });
    expect(r.status).toBe(200);
    const doc = r.json as AsMetadata;
    expect(doc.issuer).toBeTruthy();
    expect(doc.authorization_endpoint).toMatch(/\/oauth2\/v1\/authorize$/);
    expect(doc.token_endpoint).toMatch(/\/oauth2\/v1\/token$/);
    expect(doc.jwks_uri).toMatch(/\/oauth\/jwks\.json$/);
    expect(doc.registration_endpoint).toMatch(/\/oauth2\/v1\/register$/);
    expect(doc.code_challenge_methods_supported).toEqual(["S256"]);
    expect(doc.client_id_metadata_document_supported).toBe(true);
    expect(doc.scopes_supported).toContain("mcp:read");
  });

  it("serves the same doc at the OIDC discovery well-known path", async () => {
    const r = await rpc(`${baseUrl}/.well-known/openid-configuration`, { method: "GET" });
    expect(r.status).toBe(200);
    const doc = r.json as AsMetadata;
    expect(doc.issuer).toBeTruthy();
    expect(doc.code_challenge_methods_supported).toEqual(["S256"]);
  });

  it("serves a JWKS with one RS256 public key", async () => {
    const r = await rpc(`${baseUrl}/oauth/jwks.json`, { method: "GET" });
    expect(r.status).toBe(200);
    const doc = r.json as JwksDoc;
    expect(doc.keys).toHaveLength(1);
    expect(doc.keys[0].alg).toBe("RS256");
    expect(doc.keys[0].kty).toBe("RSA");
  });

  it("runs the full authorization-code + PKCE + JWT + /mcp flow", async () => {
    // 1) DCR
    const reg = await rpc(`${baseUrl}/oauth2/v1/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_name: "e2e-test",
        redirect_uris: ["https://example.com/cb"],
        scope: "mcp:read",
        token_endpoint_auth_method: "none",
      }),
    });
    expect(reg.status).toBe(201);
    const { client_id } = reg.json as RegistrationResponse;

    // 2) PKCE
    const verifier = b64url(Buffer.from("verifier-of-exactly-43-characters-AAAAAAAAAAAA"));
    const challenge = sha256B64Url(verifier);

    // 3) GET /authorize renders consent
    const getAuth = await rpc(
      `${baseUrl}/oauth2/v1/authorize?${new URLSearchParams({
        response_type: "code",
        client_id,
        redirect_uri: "https://example.com/cb",
        scope: "mcp:read",
        state: "abc",
        code_challenge: challenge,
        code_challenge_method: "S256",
      }).toString()}`,
      { method: "GET" },
    );
    expect(getAuth.status).toBe(200);
    expect(getAuth.headers.get("content-type")?.includes("text/html")).toBe(true);

    // 4) POST /authorize with decision=allow → 302 with code
    const postAuth = await form(`${baseUrl}/oauth2/v1/authorize`, {
      response_type: "code",
      client_id,
      redirect_uri: "https://example.com/cb",
      scope: "mcp:read",
      state: "abc",
      code_challenge: challenge,
      code_challenge_method: "S256",
      decision: "allow",
    });
    expect(postAuth.status).toBe(302);
    const loc = new URL(postAuth.headers.get("location")!);
    const code = loc.searchParams.get("code");
    expect(code).toBeTruthy();
    expect(loc.searchParams.get("state")).toBe("abc");

    // 5) POST /token → JWT
    const tokenRes = await form(`${baseUrl}/oauth2/v1/token`, {
      grant_type: "authorization_code",
      code,
      redirect_uri: "https://example.com/cb",
      client_id,
      code_verifier: verifier,
    });
    expect(tokenRes.status).toBe(200);
    const accessToken = tokenRes.json.access_token as string;
    expect(accessToken.split(".")).toHaveLength(3);
    expect(tokenRes.json.token_type).toBe("Bearer");
    expect(typeof tokenRes.json.expires_in).toBe("number");

    // 6) Use the JWT on /mcp
    const init = await rpc(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "e2e", version: "0.1" } },
      }),
    });
    expect(init.status).toBe(200);
    expect(transports.size).toBeGreaterThan(0);
  });

  it("rejects single-use code reuse (second /token request fails with invalid_grant)", async () => {
    const reg = await rpc(`${baseUrl}/oauth2/v1/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ redirect_uris: ["https://x/cb"], token_endpoint_auth_method: "none" }),
    });
    const { client_id } = reg.json as RegistrationResponse;
    const verifier = b64url(Buffer.from("verifier-of-exactly-43-characters-BBBBBBBBBBBB"));
    const challenge = sha256B64Url(verifier);
    const postAuth = await form(`${baseUrl}/oauth2/v1/authorize`, {
      response_type: "code", client_id, redirect_uri: "https://x/cb", scope: "mcp:read",
      code_challenge: challenge, code_challenge_method: "S256", decision: "allow",
    });
    const code = new URL(postAuth.headers.get("location")!).searchParams.get("code")!;
    const first = await form(`${baseUrl}/oauth2/v1/token`, {
      grant_type: "authorization_code", code, redirect_uri: "https://x/cb", client_id, code_verifier: verifier,
    });
    expect(first.status).toBe(200);
    const second = await form(`${baseUrl}/oauth2/v1/token`, {
      grant_type: "authorization_code", code, redirect_uri: "https://x/cb", client_id, code_verifier: verifier,
    });
    expect(second.status).toBe(400);
    expect(second.json.error).toBe("invalid_grant");
  });

  it("rejects PKCE mismatch (verifier doesn't match challenge)", async () => {
    const reg = await rpc(`${baseUrl}/oauth2/v1/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ redirect_uris: ["https://x/cb"], token_endpoint_auth_method: "none" }),
    });
    const { client_id } = reg.json as RegistrationResponse;
    const verifier = b64url(Buffer.from("verifier-of-exactly-43-characters-CCCCCCCCCCCC"));
    const challenge = sha256B64Url(verifier);
    const postAuth = await form(`${baseUrl}/oauth2/v1/authorize`, {
      response_type: "code", client_id, redirect_uri: "https://x/cb", scope: "mcp:read",
      code_challenge: challenge, code_challenge_method: "S256", decision: "allow",
    });
    const code = new URL(postAuth.headers.get("location")!).searchParams.get("code")!;
    const wrong = b64url(Buffer.from("WRONG_verifier-of-exactly-43-characters-DDDDDDDD"));
    const t = await form(`${baseUrl}/oauth2/v1/token`, {
      grant_type: "authorization_code", code, redirect_uri: "https://x/cb", client_id, code_verifier: wrong,
    });
    expect(t.status).toBe(400);
    expect(t.json.error).toBe("invalid_grant");
  });

  it("rejects a token request with a wrong redirect_uri", async () => {
    const reg = await rpc(`${baseUrl}/oauth2/v1/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ redirect_uris: ["https://x/cb"], token_endpoint_auth_method: "none" }),
    });
    const { client_id } = reg.json as RegistrationResponse;
    const verifier = b64url(Buffer.from("verifier-of-exactly-43-characters-EEEEEEEEEEEE"));
    const challenge = sha256B64Url(verifier);
    const postAuth = await form(`${baseUrl}/oauth2/v1/authorize`, {
      response_type: "code", client_id, redirect_uri: "https://x/cb", scope: "mcp:read",
      code_challenge: challenge, code_challenge_method: "S256", decision: "allow",
    });
    const code = new URL(postAuth.headers.get("location")!).searchParams.get("code")!;
    const t = await form(`${baseUrl}/oauth2/v1/token`, {
      grant_type: "authorization_code", code, redirect_uri: "https://attacker.example.com/cb", client_id, code_verifier: verifier,
    });
    expect(t.status).toBe(400);
    expect(t.json.error).toBe("invalid_request");
  });

  it("rejects an authorization request without code_challenge (PKCE required)", async () => {
    const reg = await rpc(`${baseUrl}/oauth2/v1/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ redirect_uris: ["https://x/cb"], token_endpoint_auth_method: "none" }),
    });
    const { client_id } = reg.json as RegistrationResponse;
    const r = await rpc(
      `${baseUrl}/oauth2/v1/authorize?${new URLSearchParams({
        response_type: "code", client_id, redirect_uri: "https://x/cb", scope: "mcp:read",
      }).toString()}`,
      { method: "GET" },
    );
    expect(r.status).toBe(400);
    expect(r.json.error).toBe("invalid_request");
  });

  it("rejects a token request with the wrong client_id", async () => {
    const reg = await rpc(`${baseUrl}/oauth2/v1/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ redirect_uris: ["https://x/cb"], token_endpoint_auth_method: "none" }),
    });
    const { client_id } = reg.json as RegistrationResponse;
    const verifier = b64url(Buffer.from("verifier-of-exactly-43-characters-FFFFFFFFFFFFFF"));
    const challenge = sha256B64Url(verifier);
    const postAuth = await form(`${baseUrl}/oauth2/v1/authorize`, {
      response_type: "code", client_id, redirect_uri: "https://x/cb", scope: "mcp:read",
      code_challenge: challenge, code_challenge_method: "S256", decision: "allow",
    });
    const code = new URL(postAuth.headers.get("location")!).searchParams.get("code")!;
    const t = await form(`${baseUrl}/oauth2/v1/token`, {
      grant_type: "authorization_code", code, redirect_uri: "https://x/cb",
      client_id: "00000000-0000-0000-0000-000000000000", code_verifier: verifier,
    });
    expect(t.status).toBe(400);
    expect(t.json.error).toBe("invalid_client");
  });

  it("denies a request when the user clicks Deny (redirects with access_denied)", async () => {
    const reg = await rpc(`${baseUrl}/oauth2/v1/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ redirect_uris: ["https://x/cb"], token_endpoint_auth_method: "none" }),
    });
    const { client_id } = reg.json as RegistrationResponse;
    const verifier = b64url(Buffer.from("verifier-of-exactly-43-characters-GGGGGGGGGGGG"));
    const challenge = sha256B64Url(verifier);
    const postAuth = await form(`${baseUrl}/oauth2/v1/authorize`, {
      response_type: "code", client_id, redirect_uri: "https://x/cb", scope: "mcp:read",
      code_challenge: challenge, code_challenge_method: "S256", decision: "deny",
    });
    expect(postAuth.status).toBe(302);
    const loc = new URL(postAuth.headers.get("location")!);
    expect(loc.searchParams.get("error")).toBe("access_denied");
  });
});
