import { describe, expect, it } from "vitest";
import { toolRegistry } from "../../src/server/tools/index.js";

const tool = toolRegistry.find((candidate) => candidate.name === "find_annotations");

describe("find_annotations tool", () => {
  it("filters by type and time range", async () => {
    const result = await tool?.handler(
      { fixtureId: "sample-project", filters: { type: "box", timeRange: { startMs: 0, endMs: 10000 } } },
      {} as never,
    );
    const content = result?.structuredContent as { ok: boolean; total: number; matches: Array<{ type: string }> };
    expect(content.ok).toBe(true);
    expect(content.total).toBe(1);
    expect(content.matches[0].type).toBe("box");
  });
});
