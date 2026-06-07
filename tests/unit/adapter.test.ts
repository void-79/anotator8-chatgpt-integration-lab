/**
 * Unit tests for Anotator8 Adapter
 */

import { describe, it, expect } from 'vitest';
import { Anotator8Adapter } from '../../src/server/anotator8-adapter.js';
import type { ProjectFilePayload } from '../../src/shared/types.js';

describe('Anotator8Adapter', () => {
  const adapter = new Anotator8Adapter();

  // Sample valid project data
  const validProject: ProjectFilePayload = {
    version: '24.0.0',
    videoUrl: 'https://example.com/video.mp4',
    videoSource: {
      kind: 'direct-url',
      url: 'https://example.com/video.mp4',
      duration: 120,
    },
    locale: 'en',
    nodes: [
      {
        id: 'test-001',
        type: 'annotation',
        spatial: { x: 0.1, y: 0.2, width: 0.3, height: 0.4, rotation: 0, zIndex: 1 },
        temporal: { startTime: 10.0, endTime: 20.0, duration: 10.0 },
        visual: { color: '#ff0000', opacity: 1.0, strokeWidth: 2, fill: 'transparent' },
        extensions: {
          visual: { shapeType: 'rect', annotationType: 'box', textContent: 'Test annotation' },
        },
        sync: {
          serverSeq: 1,
          localOpId: 'op-001',
          nodeId: 'client-001',
          lastSyncedAt: '2024-01-01T00:00:00Z',
          properties: {},
          integrity: {
            parentHash: '0'.repeat(64),
            signature: 'f'.repeat(128),
            publicKey: '0'.repeat(64),
          },
        },
        parentId: null,
        fractionalIndex: 'a0',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
        ownerId: 'user-001',
        isEducationRecord: true,
        dataResidency: 'us-east',
      },
    ],
  };

  describe('normalize()', () => {
    it('should parse valid project data', () => {
      const result = adapter.normalize(validProject);

      expect(result.version).toBe('24.0.0');
      expect(result.source.kind).toBe('direct-url');
      expect(result.annotations.length).toBe(1);
      expect(result.stats.totalAnnotations).toBe(1);
    });

    it('should handle missing video source', () => {
      const projectWithoutSource = { ...validProject, videoSource: undefined, videoUrl: undefined };
      const result = adapter.normalize(projectWithoutSource);

      expect(result.source.kind).toBe('none');
      expect(result.source.warnings.some((w) => w.code === 'NO_SOURCE')).toBe(true);
    });

    it('should extract annotation type from visual extension', () => {
      const result = adapter.normalize(validProject);

      expect(result.annotations[0].type).toBe('box');
      expect(result.annotations[0].shapeType).toBe('rect');
    });

    it('should normalize all annotation types', () => {
      const multiTypeProject: ProjectFilePayload = {
        ...validProject,
        nodes: [
          ...validProject.nodes,
          {
            ...validProject.nodes[0],
            id: 'test-002',
            extensions: {
              visual: { shapeType: 'ellipse', annotationType: 'ellipse' },
            },
          },
          {
            ...validProject.nodes[0],
            id: 'test-003',
            extensions: {
              visual: { shapeType: 'arrow', annotationType: 'arrow' },
            },
          },
        ],
      };

      const result = adapter.normalize(multiTypeProject);

      expect(result.annotations.length).toBe(3);
      expect(result.stats.annotationTypes.ellipse).toBe(1);
      expect(result.stats.annotationTypes.arrow).toBe(1);
    });

    it('should handle subtitle tracks and cues', () => {
      const projectWithSubtitles: ProjectFilePayload = {
        ...validProject,
        subtitleTracks: [
          { id: 'track-001', language: 'en', label: 'English', visible: true, locked: false },
        ],
        subtitleCues: [
          {
            id: 'cue-001',
            trackId: 'track-001',
            startTime: 0,
            endTime: 5,
            text: { en: 'Hello', ru: '', kk: '' },
            style: {
              fontFamily: 'system-ui',
              fontSize: 36,
              color: '#ffffff',
              backgroundColor: 'transparent',
              outlineColor: '#000000',
              outlineWidth: 2,
              shadow: true,
              align: 'center',
              verticalPosition: 'bottom',
            },
            animation: { type: 'none' },
          },
        ],
      };

      const result = adapter.normalize(projectWithSubtitles);

      expect(result.subtitleTracks.length).toBe(1);
      expect(result.stats.subtitleCueCount).toBe(1);
    });

    it('should throw on invalid structure', () => {
      expect(() => adapter.normalize(null)).toThrow();
      expect(() => adapter.normalize({})).toThrow();
      expect(() => adapter.normalize({ nodes: 'not-an-array' })).toThrow();
    });

    it('should detect invalid nodes', () => {
      const projectWithBadNodes: ProjectFilePayload = {
        ...validProject,
        nodes: [
          ...validProject.nodes,
          { id: 'bad-node', type: 'annotation' } as any, // Missing required fields
        ],
      };

      // Should still parse valid nodes
      const result = adapter.normalize(projectWithBadNodes);
      expect(result.warnings.some((w) => w.code === 'NODES_SKIPPED')).toBe(true);
    });
  });

  describe('validate()', () => {
    it('should validate a correct project', () => {
      const result = adapter.validate(validProject);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(result.checks.every((c) => c.passed)).toBe(true);
    });

    it('should detect nodes without IDs', () => {
      const projectWithoutIds: ProjectFilePayload = {
        ...validProject,
        nodes: [
          ...validProject.nodes,
          { ...validProject.nodes[0], id: '' } as any,
        ],
      };

      const result = adapter.validate(projectWithoutIds);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_NODE_ID')).toBe(true);
    });

    it('should detect invalid time ranges', () => {
      const projectWithBadTimes: ProjectFilePayload = {
        ...validProject,
        nodes: [
          {
            ...validProject.nodes[0],
            id: 'bad-time-001',
            temporal: { startTime: 20.0, endTime: 10.0, duration: -10.0 },
          },
        ],
      };

      const result = adapter.validate(projectWithBadTimes);

      expect(result.warnings.some((w) => w.code === 'INVALID_TIME_RANGE')).toBe(true);
    });

    it('should detect out-of-bounds spatial data', () => {
      const projectWithBadSpatial: ProjectFilePayload = {
        ...validProject,
        nodes: [
          {
            ...validProject.nodes[0],
            id: 'bad-spatial-001',
            spatial: { x: -0.1, y: 1.5, width: -1, height: 0.1, rotation: 0, zIndex: 1 },
          },
        ],
      };

      const result = adapter.validate(projectWithBadSpatial);

      expect(result.warnings.some((w) => w.code === 'OUT_OF_BOUNDS')).toBe(true);
    });

    it('should detect orphaned subtitle cues', () => {
      const projectWithOrphanedCues: ProjectFilePayload = {
        ...validProject,
        subtitleTracks: [{ id: 'track-001', language: 'en', label: 'English', visible: true, locked: false }],
        subtitleCues: [
          {
            id: 'cue-001',
            trackId: 'non-existent-track',
            startTime: 0,
            endTime: 5,
            text: { en: 'Hello', ru: '', kk: '' },
            style: {
              fontFamily: 'system-ui',
              fontSize: 36,
              color: '#ffffff',
              backgroundColor: 'transparent',
              outlineColor: '#000000',
              outlineWidth: 2,
              shadow: true,
              align: 'center',
              verticalPosition: 'bottom',
            },
            animation: { type: 'none' },
          },
        ],
      };

      const result = adapter.validate(projectWithOrphanedCues);

      expect(result.warnings.some((w) => w.code === 'ORPHANED_CUES')).toBe(true);
    });

    it('should detect invalid subtitle cue times', () => {
      const projectWithBadCues: ProjectFilePayload = {
        ...validProject,
        subtitleCues: [
          {
            id: 'cue-001',
            trackId: 'track-001',
            startTime: 10.0,
            endTime: 5.0,
            text: { en: 'Hello', ru: '', kk: '' },
            style: {
              fontFamily: 'system-ui',
              fontSize: 36,
              color: '#ffffff',
              backgroundColor: 'transparent',
              outlineColor: '#000000',
              outlineWidth: 2,
              shadow: true,
              align: 'center',
              verticalPosition: 'bottom',
            },
            animation: { type: 'none' },
          },
        ],
      };

      const result = adapter.validate(projectWithBadCues);

      expect(result.errors.some((e) => e.code === 'INVALID_CUE_TIME')).toBe(true);
    });

    it('should handle invalid JSON gracefully', () => {
      const result = adapter.validate('not-valid-json');

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'PARSE_ERROR')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty nodes array', () => {
      const emptyProject = { ...validProject, nodes: [] };
      const result = adapter.normalize(emptyProject);

      expect(result.annotations.length).toBe(0);
      expect(result.stats.totalAnnotations).toBe(0);
    });

    it('should handle all annotation types', () => {
      const allTypes: ProjectFilePayload = {
        ...validProject,
        nodes: [
          'box', 'polygon', 'point', 'arrow', 'text', 'image', 'ellipse', 'chapter', 'highlight', 'comment', 'tag',
        ].map((type, i) => ({
          ...validProject.nodes[0],
          id: `ann-${i}`,
          extensions: {
            visual: { shapeType: 'rect' as const, annotationType: type as any },
          },
        })),
      };

      const result = adapter.normalize(allTypes);

      expect(result.annotations.length).toBe(11);
    });

    it('should preserve text content', () => {
      const projectWithText: ProjectFilePayload = {
        ...validProject,
        nodes: [
          {
            ...validProject.nodes[0],
            extensions: {
              visual: {
                ...validProject.nodes[0].extensions.visual!,
                textContent: 'Important note here!',
              },
            },
          },
        ],
      };

      const result = adapter.normalize(projectWithText);

      expect(result.annotations[0].text).toBe('Important note here!');
    });
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
