import { describe, expect, it } from "vitest";
import { toolRegistry } from "../../src/server/tools/index.js";
import { toolOutputSchemas } from "../../src/server/schemas.js";

describe("MCP tool contracts", () => {
  it("registers the required read-only tools with schemas and error fallbacks", () => {
    const required = [
      "list_capabilities",
      "inspect_project",
      "validate_project",
      "summarize_annotations",
      "find_annotations",
      "suggest_labels",
      "create_review_plan",
      "export_chatgpt_report",
    ];
    const names = toolRegistry.map((tool) => tool.name);
    for (const name of required) expect(names).toContain(name);
    for (const tool of toolRegistry) {
      expect(tool.outputSchema).toBeDefined();
      expect(tool.empty).toBeDefined();
      expect(toolOutputSchemas[tool.name as keyof typeof toolOutputSchemas]).toBeDefined();
    }
  });

  it("keeps every tool read-only by contract description", () => {
    for (const tool of toolRegistry) {
      expect(tool.description.toLowerCase()).not.toContain("mutate silently");
      expect(tool.description.toLowerCase()).not.toContain("run shell");
    }
  });
});
