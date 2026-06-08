/**
 * src/server/oauth/security-schemes.ts
 *
 * Per-tool security scheme configuration. The OpenAI Apps SDK Auth doc
 * (https://developers.openai.com/apps-sdk/build/auth) requires every
 * MCP tool to declare its auth policy via `securitySchemes` so
 * ChatGPT knows which tools can run anonymously and which require
 * linking.
 *
 * Two scheme types are supported today:
 *   - `noauth`  — the tool is callable without a token
 *   - `oauth2`  — the tool needs a Bearer token with at least the
 *                 listed scopes
 *
 * The lab defaults to `noauth` for every tool to preserve the
 * existing demo experience. Set `MCP_OAUTH_REQUIRE_AUTH=true` to
 * flip every tool to `oauth2:mcp:read`; this is the production
 * posture.
 *
 * The `wrapTool()` helper in src/server/tools/tool-types.ts reads
 * from this module to decide whether to enforce auth at call time
 * and to emit `_meta["mcp/www_authenticate"]` on failure.
 */
export type SecurityScheme =
  | { readonly type: "noauth" }
  | { readonly type: "oauth2"; readonly scopes: ReadonlyArray<string> };

export type SecuritySchemesByTool = Readonly<Record<string, ReadonlyArray<SecurityScheme>>>;

export interface SecuritySchemesConfig {
  /** When true, every tool defaults to `oauth2:mcp:read` if no override is set. */
  readonly requireAuth: boolean;
  /** Optional per-tool overrides. Tool name → list of schemes. */
  readonly overrides: SecuritySchemesByTool;
  /** Default scope to use when requireAuth=true and a tool has no override. */
  readonly defaultScope: string;
}

/** The lab's catalog of tool names — must match the names in tools/index.ts. */
const ALL_TOOL_NAMES = [
  "list_capabilities",
  "inspect_project",
  "validate_project",
  "summarize_annotations",
  "find_annotations",
  "suggest_labels",
  "create_review_plan",
  "export_chatgpt_report",
] as const;

/** Load the security schemes config from env. */
export function loadSecuritySchemesConfig(env: NodeJS.ProcessEnv = process.env): SecuritySchemesConfig {
  const requireAuth = (env.MCP_OAUTH_REQUIRE_AUTH ?? "false").toLowerCase() === "true";
  const defaultScope = env.MCP_OAUTH_DEFAULT_SCOPE?.trim() || "mcp:read";
  // Per-tool overrides are JSON, e.g. {"inspect_project":[{"type":"noauth"}]}.
  // Optional; if not set we use the default.
  const raw = env.MCP_OAUTH_TOOL_SCHEMES_JSON?.trim();
  let overrides: SecuritySchemesByTool = {};
  if (raw) {
    try {
      overrides = JSON.parse(raw) as SecuritySchemesByTool;
    } catch {
      // Bad JSON: ignore and use the default. Documented behavior.
      overrides = {};
    }
  }
  return { requireAuth, overrides, defaultScope };
}

/**
 * Resolve the security scheme for a given tool. Returns the explicit
 * override if set, otherwise the default derived from requireAuth.
 */
export function schemeForTool(config: SecuritySchemesConfig, toolName: string): ReadonlyArray<SecurityScheme> {
  if (config.overrides[toolName]) {
    return config.overrides[toolName]!;
  }
  if (config.requireAuth) {
    return [{ type: "oauth2", scopes: [config.defaultScope] }];
  }
  return [{ type: "noauth" }];
}

/** Returns true if any of the tool's schemes requires a Bearer token. */
export function toolRequiresAuth(schemes: ReadonlyArray<SecurityScheme>): boolean {
  return schemes.some((s) => s.type === "oauth2");
}

/** Aggregate the union of all oauth2 scopes required by the tool's schemes. */
export function requiredScopesFor(schemes: ReadonlyArray<SecurityScheme>): ReadonlyArray<string> {
  const set = new Set<string>();
  for (const s of schemes) {
    if (s.type === "oauth2") {
      for (const scope of s.scopes) set.add(scope);
    }
  }
  return [...set];
}

export const TOOL_NAMES: ReadonlyArray<string> = ALL_TOOL_NAMES;
