import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { adapter } from "../../src/server/anotator8-adapter.js";
import type { ProjectFilePayload } from "../../src/shared/types.js";

const fixture = JSON.parse(readFileSync("fixtures/sample-project.anotator8.json", "utf8")) as unknown;

const validProject: ProjectFilePayload = {
  version: "24.0.0",
  videoUrl: "https://example.com/video.mp4",
  videoSource: {
    kind: "direct-url",
    url: "https://example.com/video.mp4",
    duration: 120,
  },
  locale: "en",
  nodes: [
    {
      id: "test-001",
      type: "annotation",
      spatial: { x: 0.1, y: 0.2, width: 0.3, height: 0.4, rotation: 0, zIndex: 1 },
      temporal: { startTime: 10.0, endTime: 20.0, duration: 10.0 },
      visual: { color: "#ff0000", opacity: 1.0, strokeWidth: 2, fill: "transparent" },
      extensions: {
        visual: { shapeType: "rect", annotationType: "box", textContent: "Test annotation" },
      },
      sync: {
        serverSeq: 1,
        localOpId: "op-001",
        nodeId: "client-001",
        lastSyncedAt: "2024-01-01T00:00:00Z",
        properties: {},
        integrity: {
          parentHash: "0".repeat(64),
          signature: "f".repeat(128),
          publicKey: "0".repeat(64),
        },
      },
      parentId: null,
      fractionalIndex: "a0",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      deletedAt: null,
      ownerId: "user-001",
      isEducationRecord: true,
      dataResidency: "us-east",
    },
  ],
};

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

  // ────────────────────────────────────────────────────────
  // REPO_EVIDENCE tests — verify adapter matches real Anotator8
  // C:\Anotator8\src\application\videoSources.ts
  // C:\Anotator8\src\domain\entities\UDMNode.ts
  // ────────────────────────────────────────────────────────

  describe('YouTube source inference (5 patterns from real Anotator8)', () => {
    const cases: ReadonlyArray<{ url: string; expectedId: string }> = [
      { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', expectedId: 'dQw4w9WgXcQ' },
      { url: 'https://youtu.be/dQw4w9WgXcQ', expectedId: 'dQw4w9WgXcQ' },
      { url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', expectedId: 'dQw4w9WgXcQ' },
      { url: 'https://www.youtube.com/shorts/dQw4w9WgXcQ', expectedId: 'dQw4w9WgXcQ' },
      { url: 'https://www.youtube.com/live/dQw4w9WgXcQ', expectedId: 'dQw4w9WgXcQ' },
    ];

    for (const c of cases) {
      it(`infers YouTube from ${c.url}`, () => {
        const result = adapter.normalize({ version: '24.0.0', videoUrl: c.url, nodes: [] });
        expect(result.source.kind).toBe('youtube');
        if (result.source.kind === 'youtube') {
          expect(result.source.label).toContain(c.expectedId);
        }
        expect(result.source.warnings.some((w) => w.code === 'INFERRED_SOURCE')).toBe(true);
      });
    }

    it('does NOT infer YouTube for non-YouTube URLs', () => {
      const result = adapter.normalize({
        version: '24.0.0',
        videoUrl: 'https://example.com/video.mp4',
        nodes: [],
      });
      expect(result.source.kind).toBe('direct-url');
    });
  });

  describe('unknownFields preservation (top-level project fields)', () => {
    it('preserves unknown top-level fields', () => {
      const result = adapter.normalize({
        version: '24.0.0',
        nodes: [],
        _futureField: { foo: 'bar' },
        experimentalThing: 42,
      });
      expect((result.unknownFields as any)._futureField).toEqual({ foo: 'bar' });
      expect((result.unknownFields as any).experimentalThing).toBe(42);
    });
  });
});
