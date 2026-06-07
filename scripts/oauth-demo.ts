/**
 * scripts/oauth-demo.ts
 *
 * End-to-end demo of the in-process OAuth 2.1 Authorization Server.
 * Does NOT need a browser or user interaction: simulates the consent
 * decision by directly POSTing the form to /oauth2/v1/authorize.
 *
 * Steps:
 *   1. Generate a PKCE verifier + S256 challenge.
 *   2. Start the MCP HTTP server in-process.
 *   3. Register a demo client via /oauth2/v1/register.
 *   4. GET /oauth2/v1/authorize (renders the consent page; we don't render it).
 *   5. POST /oauth2/v1/authorize with decision=allow to get an auth code.
 *   6. POST /oauth2/v1/token with the code+verifier to get a JWT.
 *   7. Call GET /mcp with the Bearer JWT (initialize + tools/list).
 *   8. Print a summary of all steps and exit 0.
 *
 * Usage:
 *   npm run oauth:demo
 *
 * Exits non-zero on any failure.
 */
import { createHttpMcpApp } from "../src/server/app.js";
import { generateCodeVerifier, codeChallengeS256 } from "../src/server/oauth/pkce.js";

const HOST = "127.0.0.1";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`oauth-demo: ${message}`);
}

function deriveBaseUrl(port: number): string {
  return `http://${HOST}:${port}`;
}

function paramsToFormBody(fields: Record<string, string>): string {
  return new URLSearchParams(fields).toString();
}

function paramsToJsonBody(fields: Record<string, unknown>): string {
  return JSON.stringify(fields);
}

/**
 * Parse an SSE event stream into a list of JSON-decoded `data:` payloads.
 * The MCP Streamable HTTP transport can return either JSON or SSE.
 */
function parseSsePayloads(text: string): unknown[] {
  const payloads: unknown[] = [];
  for (const block of text.split(/\r?\n\r?\n/)) {
    const dataLines: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("data:")) dataLines.push(line.slice("data:".length).trim());
    }
    if (dataLines.length === 0) continue;
    const joined = dataLines.join("\n");
    try { payloads.push(JSON.parse(joined)); } catch { /* ignore non-JSON frames */ }
  }
  return payloads;
}

async function rpc(
  baseUrl: string,
  path: string,
  init: { method: string; headers: Record<string, string>; body?: string },
): Promise<{ status: number; headers: Headers; json: any; text: string; sse: unknown[] }> {
  const response = await fetch(`${baseUrl}${path}`, { ...init, redirect: "manual" });
  const text = await response.text();
  const sse = parseSsePayloads(text);
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* leave json null */ }
  return { status: response.status, headers: response.headers, json, text, sse };
}

/** First JSON-RPC result from `init`, with preference for raw JSON, falling back to SSE. */
function firstMcpResult(rpcResult: { json: any; sse: unknown[] }): any {
  if (rpcResult.json?.result) return rpcResult.json;
  for (const ev of rpcResult.sse) {
    if (ev && typeof ev === "object" && "result" in (ev as Record<string, unknown>)) return ev;
  }
  return null;
}

async function main(): Promise<void> {
  // Local demo: clear any static-token env.
  delete process.env.MCP_AUTH_TOKEN;
  // Force requireAuth=false so the demo flows without per-tool gating,
  // even if the user has set MCP_OAUTH_REQUIRE_AUTH=true.
  process.env.MCP_OAUTH_REQUIRE_AUTH = "false";

  const { httpServer } = createHttpMcpApp();
  await new Promise<void>((resolve) => httpServer.listen(0, HOST, resolve));
  const addr = httpServer.address();
  assert(addr && typeof addr === "object", "server did not bind");
  const baseUrl = deriveBaseUrl(addr.port);
  const evidence: string[] = [`server url=${baseUrl}`];

  try {
    // 1) PKCE material
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeS256(verifier);
    evidence.push(`pkce verifier=${verifier.slice(0, 8)}... challenge=${challenge.slice(0, 12)}...`);

    // 2) AS metadata
    const metadata = await rpc(baseUrl, "/.well-known/oauth-authorization-server", { method: "GET", headers: {} });
    assert(metadata.status === 200, `AS metadata status=${metadata.status} body=${metadata.text}`);
    assert(metadata.json.issuer, `AS metadata missing issuer: ${metadata.text}`);
    assert(metadata.json.authorization_endpoint, "AS metadata missing authorization_endpoint");
    assert(metadata.json.token_endpoint, "AS metadata missing token_endpoint");
    assert(metadata.json.code_challenge_methods_supported?.includes("S256"), "AS metadata must support S256 PKCE");
    assert(metadata.json.jwks_uri, "AS metadata missing jwks_uri");
    evidence.push(`as issuer=${metadata.json.issuer} jwks=${metadata.json.jwks_uri}`);

    // 3) JWKS — fetch the absolute URL the metadata advertises
    const jwksFetch = await rpc(baseUrl, new URL(metadata.json.jwks_uri).pathname, { method: "GET", headers: {} });
    assert(jwksFetch.status === 200, `JWKS status=${jwksFetch.status}`);
    assert(Array.isArray(jwksFetch.json.keys) && jwksFetch.json.keys.length === 1, "JWKS must contain exactly one key");
    assert(jwksFetch.json.keys[0].alg === "RS256", "JWKS key alg must be RS256");
    evidence.push(`jwks kid=${jwksFetch.json.keys[0].kid} alg=${jwksFetch.json.keys[0].alg}`);

    // 4) DCR — register a client
    const redirectUri = "https://example.com/cb";
    const register = await rpc(baseUrl, "/oauth2/v1/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: paramsToJsonBody({
        client_name: "oauth-demo",
        redirect_uris: [redirectUri],
        scope: "mcp:read",
        token_endpoint_auth_method: "none",
      }),
    });
    assert(register.status === 201, `DCR status=${register.status} body=${register.text}`);
    const clientId = register.json.client_id;
    assert(typeof clientId === "string" && clientId.length > 0, "DCR must return client_id");
    evidence.push(`dcr client_id=${clientId}`);

    // 5) GET /authorize (renders consent; we don't parse HTML)
    const getAuth = await rpc(baseUrl, "/oauth2/v1/authorize?" + new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "mcp:read",
      state: "demo-state",
      code_challenge: challenge,
      code_challenge_method: "S256",
    }).toString(), { method: "GET", headers: {} });
    assert(getAuth.status === 200, `GET authorize status=${getAuth.status}`);
    assert(getAuth.headers.get("content-type")?.includes("text/html"), "GET authorize should return HTML consent page");
    evidence.push("authorize GET returned 200 with consent page");

    // 6) POST /authorize with decision=allow (simulated consent)
    const postAuth = await rpc(baseUrl, "/oauth2/v1/authorize", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: paramsToFormBody({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "mcp:read",
        state: "demo-state",
        code_challenge: challenge,
        code_challenge_method: "S256",
        decision: "allow",
      }),
    });
    // The handler should 302 to redirect_uri?code=...&state=...
    assert(postAuth.status === 302, `POST authorize status=${postAuth.status} (expected 302)`);
    const location = postAuth.headers.get("location");
    assert(location, "POST authorize missing Location header");
    const locUrl = new URL(location);
    const code = locUrl.searchParams.get("code");
    const state = locUrl.searchParams.get("state");
    assert(code, "POST authorize redirect missing code");
    assert(state === "demo-state", "POST authorize state echo failed");
    evidence.push(`authorize POST issued code=${code.slice(0, 12)}... state=${state}`);

    // 7) POST /token
    const token = await rpc(baseUrl, "/oauth2/v1/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: paramsToFormBody({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: verifier,
      }),
    });
    assert(token.status === 200, `Token status=${token.status} body=${token.text}`);
    assert(token.json.access_token, `Token response missing access_token: ${token.text}`);
    assert(token.json.token_type === "Bearer", "Token response must have token_type=Bearer");
    assert(typeof token.json.expires_in === "number", "Token response must have expires_in");
    const accessToken = token.json.access_token as string;
    const expiresIn = token.json.expires_in as number;
    evidence.push(`token issued expires_in=${expiresIn}s token=${accessToken.slice(0, 12)}...`);

    // 8) Call /mcp with the Bearer
    const init = await rpc(baseUrl, "/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${accessToken}`,
      },
      body: paramsToJsonBody({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "oauth-demo", version: "0.1.0" },
        },
      }),
    });
    assert(init.status === 200, `MCP initialize status=${init.status} body=${init.text}`);
    const initResult = firstMcpResult(init);
    assert(initResult?.result?.serverInfo, `MCP initialize missing serverInfo: ${init.text}`);
    evidence.push(`mcp initialize server=${initResult.result.serverInfo.name} v${initResult.result.serverInfo.version}`);
    const sessionId = init.headers.get("mcp-session-id");
    assert(sessionId, "MCP initialize missing mcp-session-id");

    // 9) tools/list with the session
    const tools = await rpc(baseUrl, "/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${accessToken}`,
        "mcp-session-id": sessionId,
      },
      body: paramsToJsonBody({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    });
    assert(tools.status === 200, `tools/list status=${tools.status}`);
    const toolsResult = firstMcpResult(tools);
    const toolNames = (toolsResult?.result?.tools ?? []).map((t: { name: string }) => t.name);
    evidence.push(`mcp tools/list returned ${toolNames.length} tools: ${toolNames.join(", ")}`);
    assert(toolNames.length >= 8, "Expected at least 8 tools (the lab's read-only catalog)");

    // 10) Negative: re-use the code (should fail single-use)
    const reuse = await rpc(baseUrl, "/oauth2/v1/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: paramsToFormBody({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: verifier,
      }),
    });
    assert(reuse.status === 400, `Reuse of auth code should be 400, got ${reuse.status}`);
    assert(reuse.json.error === "invalid_grant", `Reuse error must be invalid_grant, got ${reuse.json.error}`);
    evidence.push("auth code correctly rejected on reuse (single-use)");

    // 11) Negative: PKCE mismatch
    const wrongVerifier = generateCodeVerifier();
    const pkceFlow = await rpc(baseUrl, "/oauth2/v1/authorize", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: paramsToFormBody({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "mcp:read",
        state: "demo-state",
        code_challenge: codeChallengeS256(wrongVerifier),
        code_challenge_method: "S256",
        decision: "allow",
      }),
    });
    assert(pkceFlow.status === 302, `PKCE second flow should 302, got ${pkceFlow.status}`);
    const pkceCode = new URL(pkceFlow.headers.get("location")!).searchParams.get("code")!;
    const pkceToken = await rpc(baseUrl, "/oauth2/v1/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: paramsToFormBody({
        grant_type: "authorization_code",
        code: pkceCode,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: generateCodeVerifier(), // different verifier
      }),
    });
    assert(pkceToken.status === 400, `PKCE mismatch should 400, got ${pkceToken.status}`);
    assert(pkceToken.json.error === "invalid_grant", "PKCE mismatch must be invalid_grant");
    evidence.push("PKCE mismatch correctly rejected");

    console.log("OAUTH-DEMO PASS");
    for (const line of evidence) console.log(line);
  } finally {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  }
}

main().catch((error: unknown) => {
  console.error("OAUTH-DEMO FAIL");
  console.error(error);
  process.exit(1);
});
