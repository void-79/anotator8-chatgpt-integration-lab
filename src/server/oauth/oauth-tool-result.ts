/**
 * src/server/oauth/oauth-tool-result.ts
 *
 * Tool-call auth helper. When a tool is called and the caller is
 * unauthenticated, we want to:
 *   1. Return a structured tool error (`isError: true`, ok=false).
 *   2. Include `_meta["mcp/www_authenticate"]` per the OpenAI Apps
 *      SDK Auth doc so the SDK can surface the challenge.
 *
 * This module exposes a single helper that wraps a tool-call
 * handler so that auth failure → structured error.
 *
 * Note: at the moment the lab enforces auth at the `/mcp` HTTP
 * boundary (see app.ts `checkAuth(req, ...)`) and never reaches
 * the tool handler without a valid Bearer. This helper is here
 * for future per-tool enforcement if the lab ever ships the
 * "tools declared as noauth" distinction in a way that gets
 * bypassed (e.g. stdio mode without AS, or a future where the
 * SDK does the filtering).
 */
import type { ToolModule } from "../tools/tool-types.js";
import { schemeForTool, type SecuritySchemesConfig } from "./security-schemes.js";
import { wrapTool } from "../tools/tool-types.js";
import type { AsHandlerBundle } from "./as-handlers.js";

export interface PerToolAuthOptions {
  readonly securitySchemes: SecuritySchemesConfig;
  readonly asHandlers: AsHandlerBundle;
  /**
   * Optional per-call token extractor. Defaults to the call-time
   * context. Most call sites use a closure on the request object.
   */
  readonly getBearer?: () => string | undefined;
}

/**
 * Wrap a tool registry entry so that, when the tool requires a
 * Bearer token and the call-time token is missing or invalid,
 * the call throws a `ToolAuthError`. The `wrapTool` envelope in
 * `tool-types.ts` converts the throw into a structured failure
 * with `isError: true` and an `error` shape that includes the
 * RFC 6750 challenge string. (The challenge is then surfaced to
 * the SDK as `_meta["mcp/www_authenticate"]` via a small post-
 * processing step on the `error` shape in the tool result helper.
 *
 * Spec: OpenAI Apps SDK Auth — "When a tool requires a Bearer
 * token and the client omits it or provides an invalid token,
 * the server must respond with a `WWW-Authenticate` header and
 * include a `mcp/www_authenticate` value in the tool result
 * `_meta`."
 */
export function withToolAuth(tool: ToolModule, options: PerToolAuthOptions): ToolModule {
  const schemes = schemeForTool(options.securitySchemes, tool.name);
  if (schemes.every((s) => s.type === "noauth")) return tool;
  return wrapTool({
    ...tool,
    handler: async (args, _extra) => {
      const bearer = options.getBearer?.();
      if (!bearer) throw new ToolAuthError("invalid_request", buildChallenge("invalid_request", "Missing Bearer access token"));
      try {
        options.asHandlers.tokenIssuer.validate(bearer, []);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new ToolAuthError("invalid_token", buildChallenge("invalid_token", message));
      }
      return tool.handler(args, _extra);
    },
  });
}

class ToolAuthError extends Error {
  constructor(readonly code: string, readonly challenge: string) {
    super(`Tool auth error: ${code}`);
    this.name = "ToolAuthError";
  }
}

function buildChallenge(error: string, message: string): string {
  return `Bearer realm="anotator8-chatgpt-lab", error="${error}", error_description="${escape(message)}"`;
}

function escape(s: string): string {
  return s.replace(/"/g, '\\"');
}
