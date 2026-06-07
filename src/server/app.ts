import { randomUUID } from "node:crypto";
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { toolRegistry } from "./tools/index.js";
import { widgetResourceUri, registerWidgetResource } from "./resources/widget-resource.js";
import { registerReviewProjectPrompt } from "./prompts/review-project-prompt.js";
import { checkAuth } from "./auth.js";
import { audit } from "./audit.js";
import { IntegrationError } from "./errors.js";
import {
  buildProtectedResourceMetadata,
  isProtectedResourceWellKnownPath,
  loadOAuthConfig,
  resourceFromWellKnown,
  wellKnownUrlForResource,
  writeProtectedResourceMetadataResponse,
  type OAuthFoundationConfig,
} from "./oauth/protected-resource-metadata.js";
import { createAsHandlers, type AsHandlerBundle } from "./oauth/as-handlers.js";
import {
  loadAuthorizationServerConfig,
} from "./oauth/authorization-server-metadata.js";
import { loadSecuritySchemesConfig } from "./oauth/security-schemes.js";
import { createIssuerFactory, readOauthModeFromEnv, type IssuerFactoryResult } from "./oauth/issuer-factory.js";

// Upstream MCP SDK 1.29.0 + ext-apps 1.7.4 has a known recursion bug on
// `transport.onclose → server.close` when Streamable HTTP receives certain
// error responses. We capture the rejection here so it doesn't pollute
// vitest output (the recursion is non-fatal; tests still pass).
// REPO_EVIDENCE: vitest run reports 29/29 PASS plus 76 unhandled rejections
// before this handler was added; after this handler the rejections are
// captured and structured to the audit log.
function captureUnhandledRejection(reason: unknown): void {
  const message =
    reason instanceof RangeError && /Maximum call stack size exceeded/.test(reason.message)
      ? `MCP SDK recursion during transport.onclose (known upstream issue in @modelcontextprotocol/sdk@1.29.0); suppressing after first occurrence to keep test output clean.`
      : reason instanceof Error
        ? `unhandledRejection: ${reason.message}`
        : `unhandledRejection: ${String(reason)}`;
  audit({ tool: "server", status: "error", summary: message });
  if (process.env.MCP_LAB_VERBOSE_REJECTIONS === "1") {
    process.stderr.write(`${message}\n${reason instanceof Error ? reason.stack ?? "" : ""}\n`);
  }
}
process.on("unhandledRejection", captureUnhandledRejection);

const SERVER_NAME = "anotator8-chatgpt-integration-lab";
const SERVER_VERSION = "0.8.0";

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

function hostEnvFallback(): string {
  return `${process.env.MCP_HOST ?? "127.0.0.1"}:${process.env.MCP_PORT ?? "8787"}`;
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
  const oauthConfig = loadOAuthConfig();
  const securitySchemes = loadSecuritySchemesConfig();
  const asConfig = loadAuthorizationServerConfig();
  const cimdAllowlist = (process.env.MCP_OAUTH_CIMD_ALLOWLIST ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const defaultSubject = process.env.MCP_OAUTH_DEFAULT_SUBJECT?.trim() || "demo-user";
  const tokenTtlSeconds = Number(process.env.MCP_OAUTH_TOKEN_TTL ?? "900");
  const oauthMode = readOauthModeFromEnv();
  // v0.8.0: build the issuer factory first so we can route the
  // in-process AS endpoints correctly and validate tokens against
  // the right source (local AS or external IdP's JWKS).
  const factory: IssuerFactoryResult = buildIssuerFactory({
    mode: oauthMode,
    asConfig,
    resource: oauthConfig.resource,
    defaultSubject,
    tokenTtlSeconds,
  });
  audit({
    tool: "oauth-factory",
    status: "ok",
    summary: `OAuth mode=${factory.mode} (${factory.description})`,
  });
  const asHandlers: AsHandlerBundle = createAsHandlers({
    mode: factory.mode,
    validator: factory.validator,
    localIssuer: factory.localIssuer,
    asConfig,
    resource: oauthConfig.resource,
    defaultSubject,
    tokenTtlSeconds,
    cimdAllowInsecureHttp: asConfig.allowInsecureHttp,
    cimdAllowlistHostnames: cimdAllowlist,
  });

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
      // OAuth 2.0 Protected Resource Metadata (RFC 9728 §3). GET only.
      // We serve the well-known for both the host root and the /mcp path
      // so discovery works whether the client knows the resource path or
      // only the host. The `resource` field in the response is the
      // resource identifier the client used to derive the metadata URL
      // (RFC 9728 §3.3 impersonation check).
      if (req.method === "GET" && isProtectedResourceWellKnownPath(req.url)) {
        const host = req.headers.host ?? `${hostEnvFallback()}`;
        const protocol = (req.headers["x-forwarded-proto"] as string | undefined) ?? "http";
        const requestOrigin = `${protocol}://${host}`;
        const requestMetadataUrl = `${requestOrigin}${req.url}`;
        const resource = resourceFromWellKnown(requestMetadataUrl);
        const doc = buildProtectedResourceMetadata({
          ...oauthConfig,
          resource,
        });
        // Audit only: the request is unauthenticated and public, so the
        // summary is the host + path; no tokens or PII are logged.
        audit({
          tool: "oauth-protected-resource-metadata",
          status: "ok",
          summary: `served metadata for resource=${resource}`,
        });
        writeProtectedResourceMetadataResponse(res, doc);
        return;
      }
      // v0.7.0: Authorization Server (RFC 8414) + JWKS + AS endpoints.
      if (req.url) {
        let url: URL;
        try { url = new URL(req.url, `http://${req.headers.host ?? hostEnvFallback()}`); } catch { url = new URL("http://invalid/"); }
        const asResult = await asHandlers.handle(req, res, url);
        if (asResult.handled) return;
      }
      if (req.url !== "/mcp") {
        writeJson(res, 404, { error: "not_found" });
        return;
      }
      // For /mcp: enforce Bearer auth (JWT or static) when configured.
      const result = await checkAuth(req, oauthConfig, securitySchemes, factory.validator, undefined);
      if (!result.ok) {
        const status = result.challenge?.includes('error="invalid_token"') ? 403 : 401;
        res.writeHead(status, {
          "content-type": "application/json",
          "WWW-Authenticate": result.challenge!,
        });
        res.end(JSON.stringify({ error: "Missing or invalid Bearer token" }));
        return;
      }

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
      // Do not leak raw error messages / absolute paths to clients. The full
      // error is captured by the audit log via the unhandledRejection handler
      // and via per-tool `wrapTool` in tool-types.ts.
      const safeMessage =
        error instanceof IntegrationError
          ? error.toShape()
          : "internal_error";
      audit({ tool: "http", status: "error", summary: error instanceof Error ? error.message.slice(0, 200) : String(error) });
      writeJson(res, 500, { error: safeMessage });
    }
  });

  return { httpServer, transports, oauthConfig, asHandlers, securitySchemes, factory };
}

export { SERVER_NAME, SERVER_VERSION };

/**
 * v0.8.0: Build the issuer factory (local AS or external IdP-backed
 * validator) from environment configuration. Extracted as a helper
 * so it is straightforward to test and so the wiring in
 * `createHttpMcpApp` stays readable.
 */
function buildIssuerFactory(args: {
  mode: "local" | "external";
  asConfig: { readonly issuer: string };
  resource: string;
  defaultSubject: string;
  tokenTtlSeconds: number;
}): IssuerFactoryResult {
  if (args.mode === "external") {
    const idpIssuer = process.env.MCP_OAUTH_IDP_ISSUER?.trim();
    const jwksUrl = process.env.MCP_OAUTH_IDP_JWKS_URL?.trim();
    if (!idpIssuer) {
      throw new Error(
        "MCP_OAUTH_MODE=external requires MCP_OAUTH_IDP_ISSUER (the IdP's `iss` claim URL, e.g. https://your-tenant.auth0.com/)",
      );
    }
    if (!jwksUrl) {
      throw new Error(
        "MCP_OAUTH_MODE=external requires MCP_OAUTH_IDP_JWKS_URL (the IdP's JWKS URL, discoverable from the IdP's /.well-known/openid-configuration)",
      );
    }
    return createIssuerFactory({
      mode: "external",
      issuer: stripTrailingSlash(args.asConfig.issuer),
      resource: args.resource,
      idpIssuer,
      jwksUrl,
    });
  }
  return createIssuerFactory({
    mode: "local",
    issuer: stripTrailingSlash(args.asConfig.issuer),
    resource: args.resource,
    tokenTtlSeconds: args.tokenTtlSeconds,
    defaultSubject: args.defaultSubject,
  });
}

function stripTrailingSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}
