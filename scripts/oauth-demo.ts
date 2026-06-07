/**
 * Live evidence script for v0.3.0 OAuth Protected Resource Metadata.
 * NOT a test — prints real HTTP responses from a running server.
 * Run with: npx tsx scripts/oauth-demo.ts
 */
import { createHttpMcpApp } from "../src/server/app.js";
import { setTimeout as wait } from "node:timers/promises";

async function main() {
  // Configure a demo OAuth profile.
  process.env.MCP_AUTH_TOKEN = "demo-token-xyz";
  process.env.MCP_OAUTH_RESOURCE = "https://demo.lab.local/mcp";
  process.env.MCP_OAUTH_AUTHORIZATION_SERVERS =
    "https://auth.example.com,https://auth2.example.com";
  process.env.MCP_OAUTH_SCOPES_SUPPORTED = "mcp:read,mcp:tools,mcp:export";
  process.env.MCP_OAUTH_RESOURCE_NAME = "Anotator8 ChatGPT Integration Lab (demo)";

  const { httpServer, transports } = createHttpMcpApp();
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const addr = httpServer.address();
  if (!addr || typeof addr === "string") throw new Error("Could not bind");
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    console.log("=== GET /.well-known/oauth-protected-resource (host root) ===");
    const r1 = await fetch(`${baseUrl}/.well-known/oauth-protected-resource`);
    console.log("status:", r1.status);
    console.log("content-type:", r1.headers.get("content-type"));
    console.log("cache-control:", r1.headers.get("cache-control"));
    console.log("body:", await r1.text());
    console.log();

    console.log("=== GET /.well-known/oauth-protected-resource/mcp ===");
    const r2 = await fetch(`${baseUrl}/.well-known/oauth-protected-resource/mcp`);
    console.log("status:", r2.status);
    console.log("content-type:", r2.headers.get("content-type"));
    console.log("body:", await r2.text());
    console.log();

    console.log("=== POST /mcp without Authorization (expect 401 + resource_metadata) ===");
    const r3 = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    console.log("status:", r3.status);
    console.log("www-authenticate:", r3.headers.get("www-authenticate"));
    console.log();

    console.log("=== POST /mcp with wrong Bearer (expect 403 + resource_metadata) ===");
    const r4 = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: "Bearer wrong",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    console.log("status:", r4.status);
    console.log("www-authenticate:", r4.headers.get("www-authenticate"));
    console.log();

    console.log("=== POST /.well-known/oauth-protected-resource/mcp (expect 404, GET-only) ===");
    const r5 = await fetch(`${baseUrl}/.well-known/oauth-protected-resource/mcp`, {
      method: "POST",
    });
    console.log("status:", r5.status);
  } finally {
    for (const session of transports.values()) {
      await session.transport.close();
      await session.server.close();
    }
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  }
}

main().catch((err) => {
  console.error("DEMO FAIL", err);
  process.exit(1);
});
