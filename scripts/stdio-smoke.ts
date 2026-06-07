/**
 * Live evidence script for v0.4.0 STDIO transport.
 * Spawns the server with MCP_TRANSPORT=stdio and exercises the
 * MCP protocol (initialize, tools/list, tools/call) via the
 * official @modelcontextprotocol/sdk/client/stdio transport.
 *
 * NOT a test — prints real protocol output. Run with:
 *   npm run demo:stdio
 *   # or
 *   npx tsx scripts/stdio-smoke.ts
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

async function main(): Promise<void> {
  // Read the fixture so we can exercise inspect_project end-to-end.
  const fixturePath = resolve(process.cwd(), "fixtures", "sample-project.anotator8.json");
  const projectData = JSON.parse(readFileSync(fixturePath, "utf8")) as Record<string, unknown>;

  const serverEntry = resolve(process.cwd(), "dist", "server", "index.js");
  console.log("=== Spawning:", "node", serverEntry);
  console.log("=== Env: MCP_TRANSPORT=stdio");
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntry],
    env: {
      ...process.env,
      MCP_TRANSPORT: "stdio",
      // Force stdio mode even if a user has MCP_TRANSPORT in their shell rc.
    },
    stderr: "pipe",
  });

  // Pipe child stderr so we can show the server's banner.
  const childStderr = transport.stderr;
  if (childStderr) {
    childStderr.on("data", (chunk: Buffer) => {
      process.stderr.write(`[server] ${chunk.toString("utf8")}`);
    });
  }

  const client = new Client(
    { name: "stdio-smoke-client", version: "0.0.1" },
    { capabilities: {} },
  );

  try {
    console.log("=== client.connect(transport)");
    await client.connect(transport);

    console.log("\n=== serverInfo ===");
    const serverInfo = client.getServerVersion();
    console.log(JSON.stringify(serverInfo, null, 2));

    console.log("\n=== tools/list ===");
    const tools = await client.listTools();
    for (const t of tools.tools) {
      console.log(`- ${t.name}: ${String(t.description ?? "").slice(0, 80)}`);
    }

    console.log("\n=== tools/call inspect_project (using fixture) ===");
    const result = await client.callTool({
      name: "inspect_project",
      arguments: { projectData, projectId: "stdio-smoke" },
    });
    const text = (result.content as Array<{ type: string; text?: string }> | undefined)
      ?.map((c) => (c.type === "text" ? c.text : ""))
      .join("\n");
    console.log("content:", text?.slice(0, 400));

    console.log("\n=== capabilities ===");
    console.log(JSON.stringify(client.getServerCapabilities(), null, 2));

    console.log("\nSTDIO SMOKE PASS");
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("STDIO SMOKE FAIL", err);
  process.exit(1);
});
