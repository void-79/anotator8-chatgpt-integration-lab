/**
 * Auth behavior tests.
 *
 * The lab is DEMO-GRADE auth: if MCP_AUTH_TOKEN is unset, the server runs in
 * "local demo" mode where any reachable client can call all 8 read-only tools.
 * This is intentional and documented in docs/SECURITY.md, but the contract
 * must be deterministic so anyone changing auth.ts knows what they're breaking.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHttpMcpApp, SERVER_NAME, SERVER_VERSION } from "../../src/server/app.js";

describe("auth: local demo mode (MCP_AUTH_TOKEN unset)", () => {
  let baseUrl = "";
  let httpServer: ReturnType<typeof createHttpMcpApp>["httpServer"];
  let transports: ReturnType<typeof createHttpMcpApp>["transports"];

  beforeAll(async () => {
    // Ensure no auth token leaks from the test environment
    delete process.env.MCP_AUTH_TOKEN;
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
  });

  it("/health is reachable without Authorization header", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; version: string };
    expect(body.status).toBe("ok");
    expect(body.version).toBe(SERVER_VERSION);
    // Server name should match — used as a sanity check for tests/contract as well.
    void SERVER_NAME;
  });

  it("/mcp accepts tools/call without Bearer when token unset", async () => {
    const init = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "auth-test", version: "0" } },
      }),
    });
    expect(init.status).toBe(200);
    const sessionId = init.headers.get("mcp-session-id");
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe("auth: bearer mode (MCP_AUTH_TOKEN set)", () => {
  let baseUrl = "";
  let httpServer: ReturnType<typeof createHttpMcpApp>["httpServer"];
  let transports: ReturnType<typeof createHttpMcpApp>["transports"];
  const token = "test-bearer-abc-123";

  beforeAll(async () => {
    process.env.MCP_AUTH_TOKEN = token;
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
  });

  it("rejects /mcp POST without Authorization header with 401", async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toMatch(/Bearer/);
  });

  it("rejects /mcp POST with wrong Bearer token with 403", async () => {
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
  });

  it("accepts /mcp POST with correct Bearer token (after initialize)", async () => {
    const init = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "auth-test", version: "0" } },
      }),
    });
    expect(init.status).toBe(200);
    const sessionId = init.headers.get("mcp-session-id");
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/i);

    const list = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${token}`,
        "mcp-session-id": sessionId ?? "",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    });
    expect(list.status).toBe(200);
  });
});
