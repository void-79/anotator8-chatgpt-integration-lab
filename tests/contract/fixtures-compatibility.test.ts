import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { adapter } from "../../src/server/anotator8-adapter.js";

describe("fixtures compatibility", () => {
  it("sample project remains compatible with the adapter and validation warning contract", () => {
    const fixture = JSON.parse(readFileSync("fixtures/sample-project.anotator8.json", "utf8")) as unknown;
    const project = adapter.normalize(fixture);
    const validation = adapter.validate(fixture);
    expect(project.annotations.map((annotation) => annotation.type)).toEqual(["box", "ellipse", "arrow"]);
    expect(project.subtitles[0].cueCount).toBe(1);
    expect(validation.warnings.map((warning) => warning.code)).toContain("ORPHANED_SUBTITLE_CUE");
  });
});
