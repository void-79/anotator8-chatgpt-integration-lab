import { describe, expect, it } from "vitest";
import { toolRegistry } from "../../src/server/tools/index.js";

const tool = toolRegistry.find((candidate) => candidate.name === "validate_project");

describe("validate_project tool", () => {
  it("returns deterministic warnings for fixture", async () => {
    const result = await tool?.handler({ fixtureId: "sample-project" }, {} as never);
    const content = result?.structuredContent as { ok: boolean; warnings: Array<{ code: string }> };
    expect(content.ok).toBe(true);
    expect(content.warnings.some((warning) => warning.code === "ORPHANED_SUBTITLE_CUE")).toBe(true);
  });
});
