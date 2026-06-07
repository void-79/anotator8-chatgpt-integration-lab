import { describe, expect, it } from "vitest";
import {
  loadSecuritySchemesConfig,
  requiredScopesFor,
  schemeForTool,
  toolRequiresAuth,
  TOOL_NAMES,
} from "../../../src/server/oauth/security-schemes.js";

describe("oauth/security-schemes — per-tool auth policy", () => {
  it("loadSecuritySchemesConfig defaults to requireAuth=false (noauth everywhere)", () => {
    const cfg = loadSecuritySchemesConfig({} as NodeJS.ProcessEnv);
    expect(cfg.requireAuth).toBe(false);
    expect(cfg.defaultScope).toBe("mcp:read");
  });

  it("honors MCP_OAUTH_REQUIRE_AUTH=true and MCP_OAUTH_DEFAULT_SCOPE", () => {
    const cfg = loadSecuritySchemesConfig({
      MCP_OAUTH_REQUIRE_AUTH: "true",
      MCP_OAUTH_DEFAULT_SCOPE: "mcp:admin",
    } as NodeJS.ProcessEnv);
    expect(cfg.requireAuth).toBe(true);
    expect(cfg.defaultScope).toBe("mcp:admin");
  });

  it("schemeForTool returns noauth when requireAuth=false and no override", () => {
    const cfg = loadSecuritySchemesConfig({} as NodeJS.ProcessEnv);
    for (const name of TOOL_NAMES) {
      const s = schemeForTool(cfg, name);
      expect(s[0]?.type).toBe("noauth");
    }
  });

  it("schemeForTool returns oauth2:mcp:read when requireAuth=true and no override", () => {
    const cfg = loadSecuritySchemesConfig({ MCP_OAUTH_REQUIRE_AUTH: "true" } as NodeJS.ProcessEnv);
    for (const name of TOOL_NAMES) {
      const s = schemeForTool(cfg, name);
      expect(s[0]?.type).toBe("oauth2");
      expect((s[0] as { scopes: string[] }).scopes).toEqual(["mcp:read"]);
    }
  });

  it("schemeForTool honors per-tool JSON overrides", () => {
    const cfg = loadSecuritySchemesConfig({
      MCP_OAUTH_TOOL_SCHEMES_JSON: JSON.stringify({
        inspect_project: [{ type: "noauth" }],
        summarize_annotations: [{ type: "oauth2", scopes: ["mcp:read", "mcp:admin"] }],
      }),
    } as NodeJS.ProcessEnv);
    expect(schemeForTool(cfg, "inspect_project")[0]?.type).toBe("noauth");
    expect(schemeForTool(cfg, "summarize_annotations")[0]?.type).toBe("oauth2");
    // Tools not in the override fall back to the default.
    expect(schemeForTool(cfg, "validate_project")[0]?.type).toBe("noauth");
  });

  it("ignores invalid JSON in MCP_OAUTH_TOOL_SCHEMES_JSON (no crash)", () => {
    const cfg = loadSecuritySchemesConfig({ MCP_OAUTH_TOOL_SCHEMES_JSON: "not-json" } as NodeJS.ProcessEnv);
    expect(schemeForTool(cfg, "inspect_project")[0]?.type).toBe("noauth");
  });

  it("toolRequiresAuth is true iff any scheme is oauth2", () => {
    expect(toolRequiresAuth([{ type: "noauth" }])).toBe(false);
    expect(toolRequiresAuth([{ type: "oauth2", scopes: ["mcp:read"] }])).toBe(true);
    expect(toolRequiresAuth([{ type: "noauth" }, { type: "oauth2", scopes: [] }])).toBe(true);
  });

  it("requiredScopesFor returns the union of oauth2 scopes", () => {
    expect(requiredScopesFor([{ type: "noauth" }])).toEqual([]);
    expect(requiredScopesFor([{ type: "oauth2", scopes: ["mcp:read"] }])).toEqual(["mcp:read"]);
    expect(requiredScopesFor([{ type: "oauth2", scopes: ["a"] }, { type: "oauth2", scopes: ["a", "b"] }])).toEqual(["a", "b"]);
  });

  it("TOOL_NAMES exposes the lab's 8 catalog tools", () => {
    expect(TOOL_NAMES).toContain("list_capabilities");
    expect(TOOL_NAMES).toContain("inspect_project");
    expect(TOOL_NAMES).toContain("export_chatgpt_report");
    expect(TOOL_NAMES.length).toBe(8);
  });
});
