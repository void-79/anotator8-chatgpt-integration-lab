import { describe, expect, it } from "vitest";
import { toolOutputSchemas } from "../../src/server/schemas.js";
import { toolRegistry } from "../../src/server/tools/index.js";

describe("tool output schemas", () => {
  it("requires the common ok/error contract on every tool", () => {
    for (const [name, schema] of Object.entries(toolOutputSchemas)) {
      const tool = toolRegistry.find((candidate) => candidate.name === name);
      const parsed = schema.safeParse({ ok: false, error: { code: "invalid_input", message: "x" }, ...(tool?.empty ?? {}) });
      expect(parsed.success, name).toBe(true);
    }
  });
});
