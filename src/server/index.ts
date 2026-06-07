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
    process.stderr.write(process.env.MCP_AUTH_TOKEN ? "Auth: Bearer token required\n" : "Auth: disabled for local demo\n");
  });
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  main();
}
