import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { pathToFileURL } from "node:url";
import { createHttpMcpApp, createMcpServer, SERVER_NAME, SERVER_VERSION } from "./app.js";

export { createMcpServer, createHttpMcpApp } from "./app.js";

/**
 * Run the server. Transport is selected by `MCP_TRANSPORT`:
 *   - "http"  (default): Streamable HTTP on /mcp, OAuth 2.0 PRM,
 *     Bearer auth, CORS. Back-compat with v0.3.0.
 *   - "stdio": JSON-RPC over process.stdin/stdout. For local MCP
 *     clients (Claude Desktop, Cursor, Windsurf, Cline, OpenCode,
 *     Aider, Continue, GitHub Copilot in VS Code).
 *
 * In stdio mode `MCP_AUTH_TOKEN` is ignored (no HTTP request to
 * authenticate) — local trust is delegated to the OS user / process
 * boundary. Tools remain read-only so the worst case is information
 * disclosure of the supplied project JSON, same as HTTP demo mode
 * without a token.
 */
export async function main(): Promise<void> {
  const transportKind = (process.env.MCP_TRANSPORT ?? "http").toLowerCase();

  if (transportKind === "stdio") {
    if (process.env.MCP_AUTH_TOKEN) {
      process.stderr.write(
        "Note: MCP_AUTH_TOKEN is ignored in stdio mode (no HTTP request to authenticate). " +
          "Local trust comes from the OS process boundary.\n",
      );
    }
    const server = createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    process.stderr.write(`${SERVER_NAME} ${SERVER_VERSION} running on stdio\n`);
    return;
  }

  if (transportKind !== "http") {
    process.stderr.write(
      `Unknown MCP_TRANSPORT="${transportKind}"; expected "http" or "stdio". Falling back to http.\n`,
    );
  }

  const host = process.env.MCP_HOST ?? "127.0.0.1";
  const port = Number.parseInt(process.env.MCP_PORT ?? "8787", 10);
  const { httpServer, transports } = createHttpMcpApp();

  const shutdown = async (signal: string) => {
    process.stderr.write(`${signal} received; closing ${transports.size} MCP session(s).\n`);
    for (const { transport, server } of transports.values()) {
      await transport.close();
      await server.close();
    }
    httpServer.close(() => process.exit(0));
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  httpServer.listen(port, host, () => {
    process.stderr.write(`${SERVER_NAME} ${SERVER_VERSION} listening on http://${host}:${port}/mcp\n`);
    if (process.env.MCP_AUTH_TOKEN) {
      const tokens = process.env.MCP_AUTH_TOKEN.split(",").map((t) => t.trim()).filter(Boolean);
      process.stderr.write(`Auth: Bearer token required (${tokens.length} token(s) accepted).\n`);
    } else {
      const banner = [
        "================================================================",
        " WARNING: MCP_AUTH_TOKEN is unset.",
        " This mode is intended ONLY for local development (localhost).",
        " Any reachable network client can call all 8 read-only tools.",
        " BEFORE exposing on a public tunnel: set MCP_AUTH_TOKEN=<random>.",
        " See docs/SECURITY.md and docs/CHATGPT_APP_SETUP.md.",
        "================================================================",
      ].join("\n");
      process.stderr.write(`\n${banner}\n\n`);
    }
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  void main();
}
