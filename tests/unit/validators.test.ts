import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { adapter } from "../../src/server/anotator8-adapter.js";

const fixture = JSON.parse(readFileSync("fixtures/sample-project.anotator8.json", "utf8")) as Record<string, unknown>;

describe("project validation", () => {
  it("detects intentional orphaned subtitle cue warning", () => {
    const validation = adapter.validate(fixture);
    expect(validation.valid).toBe(true);
    expect(validation.warnings.some((warning) => warning.code === "ORPHANED_SUBTITLE_CUE")).toBe(true);
  });

  it("detects duplicate ids as errors", () => {
    const nodes = fixture.nodes as unknown[];
    const validation = adapter.validate({ ...fixture, nodes: [nodes[0], nodes[0]] });
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((warning) => warning.code === "DUPLICATE_ID")).toBe(true);
  });

  it("detects broken subtitle cue ranges as errors", () => {
    const validation = adapter.validate({
      version: "24.0.0",
      nodes: [],
      subtitleTracks: [{ id: "t1", language: "en", label: "English", visible: true, locked: false }],
      subtitleCues: [{ id: "c1", trackId: "t1", startTime: 4, endTime: 3, text: { en: "", ru: "", kk: "" } }],
    });
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((warning) => warning.code === "INVALID_CUE_RANGE")).toBe(true);
  });
});
