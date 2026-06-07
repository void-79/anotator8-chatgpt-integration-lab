import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IntegrationErrorShape } from "../../shared/types.js";
import { audit } from "../audit.js";
import { toIntegrationError } from "../errors.js";

export interface ToolModule {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema?: Record<string, unknown>;
  readonly outputSchema: unknown;
  readonly empty: Record<string, unknown>;
  readonly handler: (args: Record<string, unknown>, extra?: unknown) => Promise<Record<string, unknown>>;
}

export function success<T extends object>(data: T, text?: string) {
  const structuredContent = { ok: true, error: null, ...data };
  return {
    structuredContent,
    content: [{ type: "text" as const, text: text ?? JSON.stringify(structuredContent, null, 2) }],
  };
}

export function failure(tool: ToolModule, error: unknown) {
  const normalized = toIntegrationError(error).toShape();
  const structuredContent = {
    ok: false,
    error: normalized satisfies IntegrationErrorShape,
    ...tool.empty,
  };
  return {
    structuredContent,
    isError: true,
    content: [{ type: "text" as const, text: `${normalized.code}: ${normalized.message}` }],
  };
}

export function wrapTool(tool: ToolModule): ToolModule {
  return {
    ...tool,
    handler: async (args, extra) => {
      try {
        const result = await tool.handler(args ?? {}, extra);
        audit({ tool: tool.name, status: "ok", summary: "tool completed" });
        return result;
      } catch (error) {
        audit({ tool: tool.name, status: "error", summary: error instanceof Error ? error.message : String(error) });
        return failure(tool, error);
      }
    },
  };
}

export function registerPlainTool(server: McpServer, tool: ToolModule): void {
  server.registerTool(
    tool.name,
    {
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema as never,
      outputSchema: tool.outputSchema as never,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    tool.handler as never,
  );
}
