import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { adapter } from "../../src/server/anotator8-adapter.js";

const fixture = JSON.parse(readFileSync("fixtures/sample-project.anotator8.json", "utf8")) as unknown;

describe("Anotator8Adapter", () => {
  it("normalizes fixture data from the Anotator8 project file surface", () => {
    const project = adapter.normalize(fixture);
    expect(project.version).toBe("24.0.0");
    expect(project.source.kind).toBe("direct-url");
    expect(project.source.durationMs).toBe(72400);
    expect(project.annotations).toHaveLength(3);
    expect(project.subtitles).toHaveLength(1);
    expect(project.timeline.some((track) => track.type === "annotation")).toBe(true);
  });

  it("preserves unknown future fields", () => {
    const project = adapter.normalize(fixture);
    expect(project.unknownFields.futureReviewState).toBeDefined();
    expect(project.unknownFields._fixture).toBeDefined();
  });

  it("does not persist local blob URLs as portable video", () => {
    const project = adapter.normalize({
      version: "24.0.0",
      videoSource: { kind: "local-file", fileId: "f1", name: "clip.mp4", objectUrl: "blob:http://local/test", duration: 5 },
      nodes: [],
    });
    expect(project.source.kind).toBe("local");
    expect(project.source.url).toBeUndefined();
    expect(project.source.warnings.some((warning) => warning.code === "LOCAL_BLOB_NOT_PORTABLE")).toBe(true);
  });

  it("skips malformed annotation nodes with warnings", () => {
    const project = adapter.normalize({ version: "24.0.0", nodes: [{ id: "bad", type: "annotation" }] });
    expect(project.annotations).toHaveLength(0);
    expect(project.warnings.some((warning) => warning.code === "ANNOTATION_SKIPPED")).toBe(true);
  });
});
