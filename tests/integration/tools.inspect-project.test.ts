import { describe, expect, it } from "vitest";
import { toolRegistry } from "../../src/server/tools/index.js";

const tool = toolRegistry.find((candidate) => candidate.name === "inspect_project");

describe("inspect_project tool", () => {
  it("returns normalized project summary for fixture", async () => {
    const result = await tool?.handler({ fixtureId: "sample-project" }, {} as never);
    const content = result?.structuredContent as Record<string, unknown>;
    expect(content.ok).toBe(true);
    expect((content.stats as { annotationCount: number }).annotationCount).toBe(3);
    expect(content.unsupportedFields).toContain("futureReviewState");
  });
});
