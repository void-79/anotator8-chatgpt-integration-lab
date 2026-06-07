import { randomUUID } from "node:crypto";
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { toolRegistry } from "./tools/index.js";
import { widgetResourceUri, registerWidgetResource } from "./resources/widget-resource.js";
import { registerReviewProjectPrompt } from "./prompts/review-project-prompt.js";
import { requireBearerAuth } from "./auth.js";

const SERVER_NAME = "anotator8-chatgpt-integration-lab";
const SERVER_VERSION = "0.2.0";

const instructions = [
  "External Anotator8 ChatGPT integration lab.",
  "All tools are read-only and operate on supplied project JSON or allowlisted fixtures.",
  "Do not claim to inspect video bytes; this server only inspects project metadata, annotations, subtitles, and timeline references.",
  "For future write flows, require explicit approval and return reversible patches.",
].join("\n");

export function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions,
      capabilities: {
        tools: { listChanged: false },
        resources: { listChanged: false },
        prompts: { listChanged: false },
      },
    },
  );

  for (const tool of toolRegistry) {
    registerAppTool(
      server,
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema as never,
        outputSchema: tool.outputSchema as never,
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
        _meta: {
          ui: {
            resourceUri: widgetResourceUri(),
            visibility: ["model", "app"],
          },
        },
      },
      tool.handler as never,
    );
  }

  registerWidgetResource(server);
  registerReviewProjectPrompt(server);
  return server;
}

function allowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  const defaults = ["https://chatgpt.com", "https://chat.openai.com"];
  const configured = (process.env.CORS_ORIGIN ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return [...defaults, ...configured].includes(origin);
}

function writeJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (chunks.length === 0) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

export function createHttpMcpApp() {
  const transports = new Map<string, { transport: StreamableHTTPServerTransport; server: McpServer }>();

  const httpServer = createHttpServer(async (req, res) => {
    try {
      if (!allowedOrigin(req.headers.origin)) {
        writeJson(res, 403, { error: "Origin is not allowed" });
        return;
      }
      if (req.headers.origin) {
        res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
        res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, mcp-session-id");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
      }
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }
      if (req.url === "/health") {
        writeJson(res, 200, { status: "ok", version: SERVER_VERSION });
        return;
      }
      if (req.url === "/ready") {
        writeJson(res, 200, { status: "ready", version: SERVER_VERSION, sessions: transports.size });
        return;
      }
      if (req.url !== "/mcp") {
        writeJson(res, 404, { error: "not_found" });
        return;
      }
      if (!requireBearerAuth(req, res)) return;

      const sessionId = req.headers["mcp-session-id"];
      let session = typeof sessionId === "string" ? transports.get(sessionId) : undefined;

      if (!session) {
        const server = createMcpServer();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            transports.set(id, { transport, server });
          },
        });
        transport.onclose = () => {
          const id = transport.sessionId;
          if (id) transports.delete(id);
          void server.close();
        };
        await server.connect(transport);
        session = { transport, server };
      }

      const body = req.method === "POST" ? await readJson(req) : undefined;
      await session.transport.handleRequest(req, res, body);
    } catch (error) {
      writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  return { httpServer, transports };
}

export { SERVER_NAME, SERVER_VERSION };
