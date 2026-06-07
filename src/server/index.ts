import { createHttpMcpApp, SERVER_NAME, SERVER_VERSION } from "./app.js";

export { createMcpServer, createHttpMcpApp } from "./app.js";

export function main(): void {
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

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  main();
}
