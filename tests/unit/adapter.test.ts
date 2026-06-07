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

  describe('NodeExtensions preservation (blocks / code / studio / loroState)', () => {
    it('preserves blocks extension untouched', () => {
      const project: ProjectFilePayload = {
        ...validProject,
        nodes: [
          {
            ...validProject.nodes[0],
            id: 'with-blocks',
            extensions: {
              visual: { shapeType: 'rect', annotationType: 'box' },
              blocks: {
                blockLayoutType: 'grid',
                borderStyle: 'solid',
                childConnectionIds: ['c1' as any, 'c2' as any],
              } as any,
            },
          },
        ],
      };
      const result = adapter.normalize(project);
      expect(result.annotations[0].extensions).toBeDefined();
      expect((result.annotations[0].extensions as any).blocks).toBeDefined();
      expect((result.annotations[0].extensions as any).blocks.blockLayoutType).toBe('grid');
    });

    it('preserves code extension untouched', () => {
      const project: ProjectFilePayload = {
        ...validProject,
        nodes: [
          {
            ...validProject.nodes[0],
            id: 'with-code',
            extensions: {
              visual: { shapeType: 'rect', annotationType: 'box' },
              code: {
                codeLanguage: 'python',
                sourceCode: 'print("hi")',
                sandboxCapabilities: [],
              } as any,
            },
          },
        ],
      };
      const result = adapter.normalize(project);
      expect((result.annotations[0].extensions as any).code).toBeDefined();
      expect((result.annotations[0].extensions as any).code.codeLanguage).toBe('python');
    });

    it('preserves studio extension untouched', () => {
      const project: ProjectFilePayload = {
        ...validProject,
        nodes: [
          {
            ...validProject.nodes[0],
            id: 'with-studio',
            extensions: {
              visual: { shapeType: 'rect', annotationType: 'box' },
              studio: { volumeMultiplier: 1.0, audioPan: 0.0, isLocked: false } as any,
            },
          },
        ],
      };
      const result = adapter.normalize(project);
      expect((result.annotations[0].extensions as any).studio).toBeDefined();
    });

    it('preserves v24.0 loroState inside visual extension', () => {
      const project: ProjectFilePayload = {
        ...validProject,
        nodes: [
          {
            ...validProject.nodes[0],
            id: 'with-loro',
            extensions: {
              visual: {
                shapeType: 'rect',
                annotationType: 'box',
                loroState: 'YWJjZGVm', // base64 of "abcdef"
              },
            },
          },
        ],
      };
      const result = adapter.normalize(project);
      expect((result.annotations[0].extensions as any).visual?.loroState).toBe('YWJjZGVm');
    });

    it('warns on empty loroState', () => {
      const project: ProjectFilePayload = {
        ...validProject,
        nodes: [
          {
            ...validProject.nodes[0],
            id: 'empty-loro',
            extensions: {
              visual: { shapeType: 'rect', annotationType: 'box', loroState: '' },
            },
          },
        ],
      };
      const result = adapter.normalize(project);
      expect(
        result.annotations[0].warnings.some((w) => w.code === 'EMPTY_LORO_STATE'),
      ).toBe(true);
    });
  });

  describe('SyncMetadata handling (REPO_EVIDENCE: required in real Anotator8)', () => {
    it('does NOT warn when sync is present', () => {
      const result = adapter.normalize(validProject);
      const ann = result.annotations[0];
      expect(ann.warnings.some((w) => w.code === 'MISSING_SYNC_METADATA')).toBe(false);
    });

    it('warns when sync is missing', () => {
      // validProject.nodes[0] has sync — strip it explicitly
      const { sync: _omit, ...nodeWithoutSync } = validProject.nodes[0] as any;
      const project: ProjectFilePayload = {
        ...validProject,
        nodes: [
          {
            ...nodeWithoutSync,
            id: 'no-sync',
          },
        ] as any,
      };
      const result = adapter.normalize(project);
      const ann = result.annotations.find((a) => a.id === 'no-sync');
      expect(ann).toBeDefined();
      expect(ann!.warnings.some((w) => w.code === 'MISSING_SYNC_METADATA')).toBe(true);
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
