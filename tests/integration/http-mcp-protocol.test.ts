/**
 * HTTP-level MCP protocol test — actually starts the Express server,
 * sends real JSON-RPC requests over HTTP, and asserts the responses
 * match the MCP 2025-06-18 specification.
 *
 * Why this exists:
 *   - In-process unit tests can pass even when the SDK wiring is wrong.
 *   - The integration prompt requires real runtime evidence that the
 *     server speaks MCP — not just "compiles cleanly".
 *   - This is the lab's equivalent of running the MCP Inspector.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer, type Server } from 'node:http';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { registerListCapabilities } from '../../src/server/tools/list-capabilities.js';
import { registerInspectProject } from '../../src/server/tools/inspect-project.js';
import { registerValidateProject } from '../../src/server/tools/validate-project.js';
import { registerSummarizeAnnotations } from '../../src/server/tools/summarize-annotations.js';
import { registerFindAnnotations } from '../../src/server/tools/find-annotations.js';
import { registerCreateReviewPlan } from '../../src/server/tools/create-review-plan.js';
import { registerExportChatGPTTReport } from '../../src/server/tools/export-chatgpt-report.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpServer as McpServerClass } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppResource } from '@modelcontextprotocol/ext-apps/server';
import { WIDGET_HTML } from '../../src/server/resources/widget-resource.js';
import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';

// ─────────────────────────────────────────────────────────────────────────
// Lightweight server harness — replicates src/server/index.ts but without
// starting a global listener (we drive lifecycle from the test).
// ─────────────────────────────────────────────────────────────────────────

const SERVER_NAME = 'anotator8-chatgpt-lab-test';
const SERVER_VERSION = '0.2.0';

function buildMcpServer(): McpServer {
  const server = new McpServerClass(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions: 'Test instance of the Anotator8 read-only MCP server.',
      capabilities: {
        tools: { listChanged: false },
        prompts: { listChanged: false },
        resources: { listChanged: false },
      },
    },
  );

  registerListCapabilities(server);
  registerInspectProject(server);
  registerValidateProject(server);
  registerSummarizeAnnotations(server);
  registerFindAnnotations(server);
  registerCreateReviewPlan(server);
  registerExportChatGPTTReport(server);

  server.resource(
    'project',
    new ResourceTemplate('project:///{projectId}', { list: undefined }),
    { description: 'Stub project resource' },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'application/json', text: '{}' }],
    }),
  );

  registerAppResource(
    server,
    'anotator8-widget',
    'ui://widget/anotator8-widget.html',
    { description: 'Widget (test harness)' },
    async () => ({
      contents: [{
        uri: 'ui://widget/anotator8-widget.html',
        mimeType: RESOURCE_MIME_TYPE,
        text: WIDGET_HTML,
      }],
    }),
  );

  return server;
}

const fixturePath = resolve(__dirname, '../../fixtures/sample-project.anatator8.json');
const fixtureData = JSON.parse(readFileSync(fixturePath, 'utf-8'));

// ─────────────────────────────────────────────────────────────────────────
// JSON-RPC helpers — the SDK's Streamable HTTP transport responds with
// Server-Sent Events by default. We accept either SSE or plain JSON
// (the SDK may also return JSON if the client sends `Accept: application/json`).
// ─────────────────────────────────────────────────────────────────────────

interface RpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

function parseSse(text: string): RpcResponse | null {
  // Find the LAST `data: ` line — that's the final JSON-RPC message.
  const lines = text.split(/\r?\n/);
  let lastData: string | null = null;
  for (const line of lines) {
    if (line.startsWith('data: ')) lastData = line.slice(6);
  }
  if (!lastData) return null;
  try {
    return JSON.parse(lastData) as RpcResponse;
  } catch {
    return null;
  }
}

async function postJson(url: string, body: unknown, sessionId?: string): Promise<{ status: number; body: RpcResponse; sessionId: string | undefined; raw: string }> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  };
  if (sessionId) headers['mcp-session-id'] = sessionId;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let parsed: RpcResponse;
  const contentType = res.headers.get('content-type') ?? '';

  if (contentType.includes('text/event-stream')) {
    const sseParsed = parseSse(text);
    parsed = sseParsed ?? { jsonrpc: '2.0', id: null, error: { code: -32700, message: `SSE parse failed: ${text.slice(0, 200)}` } };
  } else {
    try {
      parsed = JSON.parse(text) as RpcResponse;
    } catch {
      parsed = { jsonrpc: '2.0', id: null, error: { code: -32700, message: `Non-JSON response: ${text.slice(0, 200)}` } };
    }
  }

  return { status: res.status, body: parsed, sessionId: res.headers.get('mcp-session-id') ?? undefined, raw: text };
}

// ─────────────────────────────────────────────────────────────────────────
// Lifecycle
// ─────────────────────────────────────────────────────────────────────────

let port: number;
let baseUrl: string;
let httpServer: Server;
let sessionId: string | undefined;

beforeAll(async () => {
  const mcp = buildMcpServer();
  const app = createMcpExpressApp({ host: '127.0.0.1' });

  // Mount the same handlers as src/server/index.ts (POST + GET + DELETE)
  const { StreamableHTTPServerTransport } = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
  const transports: Record<string, InstanceType<typeof StreamableHTTPServerTransport>> = {};
  const { randomUUID } = await import('node:crypto');

  app.post('/mcp', async (req, res) => {
    const sid = req.headers['mcp-session-id'] as string | undefined;
    let transport = sid ? transports[sid] : undefined;
    if (!transport) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSid) => { transports[newSid] = transport!; },
      });
      transport.onclose = () => {
        const s = transport!.sessionId;
        if (s) delete transports[s];
      };
      await mcp.connect(transport);
    }
    await transport.handleRequest(req, res, req.body);
  });

  app.get('/mcp', async (req, res) => {
    const sid = req.headers['mcp-session-id'] as string | undefined;
    if (!sid || !transports[sid]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    await transports[sid].handleRequest(req, res);
  });

  app.delete('/mcp', async (req, res) => {
    const sid = req.headers['mcp-session-id'] as string | undefined;
    if (!sid || !transports[sid]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    await transports[sid].handleRequest(req, res);
  });

  await new Promise<void>((resolve) => {
    httpServer = app.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = httpServer.address();
  if (!addr || typeof addr === 'string') throw new Error('Failed to bind test server');
  port = addr.port;
  baseUrl = `http://127.0.0.1:${port}/mcp`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => httpServer?.close(() => resolve()));
});

// ─────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────

describe('MCP HTTP transport (real JSON-RPC over HTTP)', () => {
  it('initializes a session and returns server info', async () => {
    const init = await postJson(baseUrl, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'http-protocol-test', version: '0.0.0' },
      },
    });
    expect(init.status).toBe(200);
    expect(init.body.error).toBeUndefined();
    expect(init.body.result).toBeDefined();
    const result = init.body.result as { serverInfo?: { name: string; version: string }; capabilities?: unknown };
    expect(result.serverInfo?.name).toBe(SERVER_NAME);
    expect(result.serverInfo?.version).toBe(SERVER_VERSION);
    expect(result.capabilities).toBeDefined();
    sessionId = init.sessionId;
    expect(sessionId).toBeDefined();
  });

  it('lists the 7 tools registered for the integration', async () => {
    if (!sessionId) throw new Error('session not initialized');
    // Acknowledge the initialize notification before listing
    await postJson(baseUrl, { jsonrpc: '2.0', method: 'notifications/initialized' }, sessionId);
    const list = await postJson(baseUrl, { jsonrpc: '2.0', id: 2, method: 'tools/list' }, sessionId);
    expect(list.status).toBe(200);
    expect(list.body.error).toBeUndefined();
    const tools = (list.body.result as { tools: Array<{ name: string }> }).tools;
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      'create_review_plan',
      'export_chatgpt_report',
      'find_annotations',
      'inspect_project',
      'list_capabilities',
      'summarize_annotations',
      'validate_project',
    ]);
  });

  it('calls list_capabilities and returns the documented shape', async () => {
    if (!sessionId) throw new Error('session not initialized');
    const res = await postJson(
      baseUrl,
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_capabilities', arguments: {} } },
      sessionId,
    );
    expect(res.status).toBe(200);
    expect(res.body.error).toBeUndefined();
    const result = res.body.result as {
      content: Array<{ type: string; text: string }>;
      structuredContent: { supportedFeatures: string[]; limitations: string[]; annotationTypes: string[]; supportedSubtitleLanguages: string[] };
    };
    // Content + structuredContent per MCP spec
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content[0].type).toBe('text');
    expect(result.structuredContent.supportedFeatures).toContain('read_only_operations');
    expect(result.structuredContent.annotationTypes).toContain('box');
  });

  it('calls inspect_project on the fixture and returns source + stats', async () => {
    if (!sessionId) throw new Error('session not initialized');
    const res = await postJson(
      baseUrl,
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'inspect_project', arguments: { projectData: fixtureData, projectId: 'fixture-1' } },
      },
      sessionId,
    );
    expect(res.status).toBe(200);
    expect(res.body.error).toBeUndefined();
    const result = res.body.result as {
      structuredContent: {
        projectId: string;
        version: string;
        source: { kind: string; label: string; durationMs: number };
        stats: { totalAnnotations: number; hasTemporalData: boolean };
        rawSummary: { nodeCount: number; trackCount: number; version: string };
        warnings: unknown[];
      };
    };
    expect(result.structuredContent.projectId).toBe('fixture-1');
    expect(result.structuredContent.version).toBe('24.0.0');
    expect(result.structuredContent.source.kind).toBe('direct-url');
    expect(result.structuredContent.stats.totalAnnotations).toBe(5);
    expect(result.structuredContent.stats.hasTemporalData).toBe(true);
    expect(result.structuredContent.rawSummary.nodeCount).toBe(5);
    expect(Array.isArray(result.structuredContent.warnings)).toBe(true);
  });

  it('calls find_annotations with filters and respects limit', async () => {
    if (!sessionId) throw new Error('session not initialized');
    const res = await postJson(
      baseUrl,
      {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'find_annotations',
          arguments: {
            projectData: fixtureData,
            filters: { type: 'box' },
            limit: 10,
          },
        },
      },
      sessionId,
    );
    expect(res.status).toBe(200);
    expect(res.body.error).toBeUndefined();
    const result = res.body.result as {
      structuredContent: { matches: Array<{ type: string }>; total: number; filters: unknown };
    };
    expect(result.structuredContent.total).toBeGreaterThanOrEqual(1);
    for (const m of result.structuredContent.matches) {
      expect(m.type).toBe('box');
    }
  });

  it('rejects tools/call for an unknown tool (does not silently succeed)', async () => {
    if (!sessionId) throw new Error('session not initialized');
    const res = await postJson(
      baseUrl,
      { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'nope', arguments: {} } },
      sessionId,
    );

    // Acceptable error shapes (any of these counts as a non-silent failure):
    // 1. HTTP error status (4xx/5xx)
    // 2. JSON-RPC error envelope
    // 3. Tool-level error in structuredContent
    // What we MUST NOT see: a 200 with a normal result.structuredContent
    const isHttpError = res.status >= 400;
    const isJsonRpcError = !!res.body.error;
    const structured = (res.body.result as { structuredContent?: { error?: string }; isError?: boolean } | undefined);
    const isToolError = !!structured?.structuredContent?.error || structured?.isError === true;

    if (!isHttpError && !isJsonRpcError && !isToolError) {
      throw new Error(
        `Unknown tool returned what looks like a success: status=${res.status}, body=${JSON.stringify(res.body, null, 2).slice(0, 500)}`
      );
    }
    expect(true).toBe(true);
  });
});
