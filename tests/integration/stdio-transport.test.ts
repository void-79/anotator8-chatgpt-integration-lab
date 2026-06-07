/**
 * STDIO transport roundtrip — proves the server speaks MCP 2025-06-18
 * over stdio for local clients (Claude Desktop, Cursor, Windsurf,
 * Cline, OpenCode, Aider, etc.).
 *
 * Spawns the compiled dist/server/index.js with MCP_TRANSPORT=stdio,
 * runs initialize + tools/list + tools/call through the official
 * @modelcontextprotocol/sdk/client/stdio transport, then closes.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, beforeAll } from "vitest";

const SERVER_ENTRY = resolve(process.cwd(), "dist", "server", "index.js");
const FIXTURE = resolve(process.cwd(), "fixtures", "sample-project.anotator8.json");

describe("stdio transport", () => {
  beforeAll(() => {
    if (!existsSync(SERVER_ENTRY)) {
      throw new Error(
        `dist/server/index.js not found at ${SERVER_ENTRY}. ` +
          `Run \`npm run build\` before \`npm test\` (the pretest script does this).`,
      );
    }
  });

  it("initialize + tools/list + tools/call through stdio", async () => {
    const projectData = JSON.parse(readFileSync(FIXTURE, "utf8")) as Record<string, unknown>;

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [SERVER_ENTRY],
      env: {
        ...process.env,
        MCP_TRANSPORT: "stdio",
        // Force the spawn to ignore any shell MCP_TRANSPORT=http override.
        MCP_AUTH_TOKEN: "",
        MCP_HOST: "",
        MCP_PORT: "",
      },
      stderr: "pipe",
    });

    // Drain child stderr so it does not pollute vitest output.
    const childStderr = transport.stderr;
    const stderrChunks: string[] = [];
    if (childStderr) {
      childStderr.on("data", (chunk: Buffer) => {
        stderrChunks.push(chunk.toString("utf8"));
      });
    }

    const client = new Client(
      { name: "stdio-test-client", version: "0.0.1" },
      { capabilities: {} },
    );

    try {
      await client.connect(transport);

      const serverInfo = client.getServerVersion();
      expect(serverInfo?.name).toBe("anotator8-chatgpt-integration-lab");
      expect(typeof serverInfo?.version).toBe("string");

      const caps = client.getServerCapabilities();
      expect(caps).toBeDefined();
      expect(caps?.tools).toBeDefined();
      expect(caps?.resources).toBeDefined();
      expect(caps?.prompts).toBeDefined();

      const tools = await client.listTools();
      const names = tools.tools.map((t) => t.name);
      expect(names).toContain("list_capabilities");
      expect(names).toContain("inspect_project");
      expect(names).toContain("validate_project");
      expect(names).toContain("summarize_annotations");
      expect(names).toContain("find_annotations");
      expect(names).toContain("suggest_labels");
      expect(names).toContain("create_review_plan");
      expect(names).toContain("export_chatgpt_report");

      // All tools must be read-only.
      for (const t of tools.tools) {
        expect(t.annotations?.readOnlyHint).toBe(true);
        expect(t.annotations?.destructiveHint).toBe(false);
      }

      const result = await client.callTool({
        name: "inspect_project",
        arguments: { projectData, projectId: "stdio-test" },
      });
      const text = (result.content as Array<{ type: string; text?: string }>)
        .filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("\n");
      // The inspector normalizes videoSource -> source. Either may appear in
      // the human-readable text part; the structuredContent always has `source`.
      expect(text).toContain("stdio-test");
      const structured = (result as { structuredContent?: Record<string, unknown> })
        .structuredContent;
      expect(structured).toBeDefined();
      expect(JSON.stringify(structured)).toMatch(/videoSource|source/);
    } finally {
      await client.close();
    }
  }, 30_000);

  it("ignores MCP_AUTH_TOKEN in stdio mode (no Bearer challenge, no crash)", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [SERVER_ENTRY],
      env: {
        ...process.env,
        MCP_TRANSPORT: "stdio",
        // Even with a token set, stdio mode should not require Bearer.
        MCP_AUTH_TOKEN: "some-token-that-must-be-ignored",
        MCP_HOST: "",
        MCP_PORT: "",
      },
      stderr: "pipe",
    });

    const childStderr = transport.stderr;
    const stderrChunks: string[] = [];
    if (childStderr) {
      childStderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk.toString("utf8")));
    }

    const client = new Client(
      { name: "stdio-token-ignored", version: "0.0.1" },
      { capabilities: {} },
    );

    try {
      await client.connect(transport);
      const tools = await client.listTools();
      expect(tools.tools.length).toBeGreaterThan(0);
      // Banner should mention that the token is being ignored.
      const banner = stderrChunks.join("");
      expect(banner).toMatch(/ignored in stdio mode/i);
    } finally {
      await client.close();
    }
  }, 30_000);
});
