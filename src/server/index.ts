/**
 * Anotator8 ChatGPT Integration Lab - MCP Server
 *
 * Architecture:
 * - Uses @modelcontextprotocol/sdk for MCP server
 * - Uses @modelcontextprotocol/ext-apps for ChatGPT Apps compatibility
 * - Implements read-only tools for Anotator8 project analysis
 * - Transport: Streamable HTTP (ChatGPT Developer Mode compatible)
 *
 * Modules:
 * - tools/*.ts: Individual tool implementations
 * - prompts/*.ts: MCP prompt templates
 * - resources/widget-resource.ts: ChatGPT App widget
 */

import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { bearerAuth } from '../middleware/auth.js';
import { WIDGET_HTML } from './resources/widget-resource.js';
import { registerListCapabilities } from './tools/list-capabilities.js';
import { registerInspectProject } from './tools/inspect-project.js';
import { registerValidateProject } from './tools/validate-project.js';
import { registerSummarizeAnnotations } from './tools/summarize-annotations.js';
import { registerFindAnnotations } from './tools/find-annotations.js';
import { registerCreateReviewPlan } from './tools/create-review-plan.js';
import { registerExportChatGPTTReport } from './tools/export-chatgpt-report.js';
import { registerPrompts } from './prompts/project-review.js';

// ────────────────────────────────────────────────────
// Server Configuration
// ────────────────────────────────────────────────────
const SERVER_NAME = 'anotator8-chatgpt-lab';
const SERVER_VERSION = '0.2.0';

const INSTRUCTIONS = `
Anotator8 ChatGPT Integration Lab - Read-only MCP server for video annotation projects.

Capabilities:
- list_capabilities: Show all available features and limitations
- inspect_project: Analyze Anotator8 project JSON
- validate_project: Check project data consistency
- summarize_annotations: Generate annotation statistics
- find_annotations: Search/filter annotations by criteria
- create_review_plan: Generate a manual review checklist
- export_chatgpt_report: Create portable report for ChatGPT

Input: Accept Anotator8 project JSON directly in tool arguments.
Security: All tools are read-only. No file system access. No mutation.
Tools MUST be called with valid project data. Projects must be under 10MB.
`.trim();

// ────────────────────────────────────────────────────
// Server Creation
// ────────────────────────────────────────────────────
export function createServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions: INSTRUCTIONS,
      capabilities: {
        tools: { listChanged: true },
        prompts: { listChanged: false },
        resources: { listChanged: false },
      },
    }
  );

  // Register all tools
  registerListCapabilities(server);
  registerInspectProject(server);
  registerValidateProject(server);
  registerSummarizeAnnotations(server);
  registerFindAnnotations(server);
  registerCreateReviewPlan(server);
  registerExportChatGPTTReport(server);

  // Register prompts
  registerPrompts(server);

  // ────────────────────────────────────────────────────
  // Resource Templates
  // ────────────────────────────────────────────────────
  server.resource(
    'project',
    new ResourceTemplate('project:///{projectId}', {
      list: async () => ({ resources: [] }),
      complete: {},
    }),
    {
      description: 'Read an Anotator8 project by its ID (stub — pass project data directly to tools)',
    },
    async (_uri: URL, variables: Record<string, string | string[]>) => {
      const projectId = variables['projectId'];
      return {
        contents: [{
          uri: `project:///${projectId}`,
          mimeType: 'application/json',
          text: JSON.stringify({
            projectId,
            note: 'Project resource lookup is a stub. Pass project data directly to tools for now.',
          }),
        }],
      };
    }
  );

  // ────────────────────────────────────────────────────
  // Widget Resource
  // ────────────────────────────────────────────────────
  registerAppResource(
    server,
    'anotator8-widget',
    'ui://widget/anotator8-widget.html',
    {
      description: 'Anotator8 project summary panel for ChatGPT — displays annotation counts, warnings, and validation results.',
    },
    async () => ({
      contents: [{
        uri: 'ui://widget/anotator8-widget.html',
        mimeType: RESOURCE_MIME_TYPE,
        text: WIDGET_HTML,
        _meta: {
          ui: {
            prefersBorder: true,
            domain: 'https://anotator8-chatgpt-integration.local',
            csp: {
              connectDomains: [],
              resourceDomains: [],
            },
          },
        },
      }],
    })
  );

  return server;
}

// ────────────────────────────────────────────────────
// Main Entry Point
// ────────────────────────────────────────────────────
export function main(): void {
  const server = createServer();

  const host = process.env.MCP_HOST ?? '127.0.0.1';
  const port = parseInt(process.env.MCP_PORT ?? '8787', 10);

  console.log(`Starting ${SERVER_NAME} v${SERVER_VERSION}...`);

    const app = createMcpExpressApp({ host });
    // Parse JSON bodies for MCP POST requests (must run before route handlers)
    // Note: body-parser is registered by createMcpExpressApp internally; adding a
    // second json() layer causes "stream is not readable" errors.
    // Only add here if the SDK's internal parser is insufficient.

  const transports: Record<string, StreamableHTTPServerTransport> = {};

  // Health & Readiness Endpoints
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', ts: Date.now() });
  });

  app.get('/ready', (_req, res) => {
    res.json({
      status: 'ready',
      version: SERVER_VERSION,
      sessions: Object.keys(transports).length,
    });
  });

  // Rate Limiting
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
  });

  // POST handler — new sessions and subsequent requests
  app.post('/mcp', limiter, bearerAuth, async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          transports[sid] = transport;
        },
      });
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) delete transports[sid];
      };
      await server.connect(transport);
    }

    await transport.handleRequest(req, res, req.body);
  });

  // GET handler — SSE stream
  app.get('/mcp', limiter, bearerAuth, async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    await transports[sessionId].handleRequest(req, res);
  });

  // DELETE handler — terminate session
  app.delete('/mcp', limiter, bearerAuth, async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    await transports[sessionId].handleRequest(req, res);
  });

  // Graceful Shutdown
  let isShuttingDown = false;
  const shutdown = (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`${signal} received, shutting down gracefully...`);
    for (const [sid, transport] of Object.entries(transports)) {
      transport.close();
      delete transports[sid];
    }
    server.close();
    console.log('Server closed.');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  app.listen(port, () => {
    console.log(`${SERVER_NAME} v${SERVER_VERSION} listening on http://${host}:${port}`);
    console.log('MCP endpoint: POST/GET/DELETE /mcp');
    console.log('Health: GET /health');
    console.log('Ready:  GET /ready');
    if (process.env.MCP_AUTH_TOKEN) {
      console.log('Auth: Bearer token required');
    } else {
      console.log('Auth: DISABLED (set MCP_AUTH_TOKEN to enable)');
    }
  });
}

// ────────────────────────────────────────────────────
// Auto-start (ESM entry point detection)
// ────────────────────────────────────────────────────
import { fileURLToPath } from 'node:url';
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) main();
