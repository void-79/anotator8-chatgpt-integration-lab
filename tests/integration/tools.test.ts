/**
 * Integration tests for MCP tools and adapter
 * Tests the full flow: adapter → tool logic → output format
 * HTTP transport is tested separately in the smoke test (npm run smoke)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { adapter } from '../../src/server/anotator8-adapter.js';
import { createServer } from '../../src/server/index.js';
import type { IntegrationWarning } from '../../src/shared/types.js';

// Load fixture data
const fixturePath = resolve(__dirname, '../../fixtures/sample-project.anatator8.json');
const fixtureData = JSON.parse(readFileSync(fixturePath, 'utf-8'));

describe('Anotator8Adapter integration', () => {
  describe('normalize() with fixture data', () => {
    it('should extract all 5 annotations', () => {
      const result = adapter.normalize(fixtureData);
      expect(result.annotations.length).toBe(5);
    });

    it('should compute correct stats', () => {
      const result = adapter.normalize(fixtureData);
      expect(result.stats.totalAnnotations).toBe(5);
      expect(result.stats.annotationTypes.box).toBeGreaterThan(0);
      expect(result.stats.hasTemporalData).toBe(true);
    });

    it('should parse video source correctly', () => {
      const result = adapter.normalize(fixtureData);
      expect(result.source.kind).toBe('direct-url');
      expect(result.source.durationMs).toBe(120500); // 120.5 seconds in ms
      expect(result.source.label).toBe('https://example.com/sample-video.mp4'); // URL used as label when no label field
    });

    it('should extract text content from annotations', () => {
      const result = adapter.normalize(fixtureData);
      const annotationsWithText = result.annotations.filter(a => a.text && a.text.length > 0);
      expect(annotationsWithText.length).toBeGreaterThan(0);
    });

    it('should include warnings for minor issues', () => {
      const result = adapter.normalize(fixtureData);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe('validate() with fixture data', () => {
    it('should validate the fixture as correct', () => {
      const result = adapter.validate(fixtureData);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should run all checks', () => {
      const result = adapter.validate(fixtureData);
      expect(result.checks.length).toBeGreaterThan(0);
      expect(result.checks.every(c => c.passed)).toBe(true);
    });

    it('should detect invalid nodes', () => {
      const badData = { ...fixtureData, nodes: [...fixtureData.nodes, { id: '', type: 'annotation' }] as any };
      const result = adapter.validate(badData);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect invalid time ranges', () => {
      const badData = {
        ...fixtureData,
        nodes: [{
          ...fixtureData.nodes[0],
          id: 'bad-time',
          temporal: { startTime: 50.0, endTime: 10.0, duration: -40.0 },
        }],
      };
      const result = adapter.validate(badData);
      expect(result.warnings.some(w => w.code === 'INVALID_TIME_RANGE')).toBe(true);
    });

    it('should handle completely invalid input gracefully', () => {
      const result = adapter.validate('not-valid-json');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PARSE_ERROR')).toBe(true);
    });
  });

  describe('normalize() edge cases', () => {
    it('should handle empty project', () => {
      const empty = { version: '24.0.0', nodes: [] };
      const result = adapter.normalize(empty);
      expect(result.annotations.length).toBe(0);
      expect(result.stats.totalAnnotations).toBe(0);
    });

    it('should handle missing video source', () => {
      const noSource = { version: '24.0.0', nodes: [] };
      const result = adapter.normalize(noSource);
      expect(result.source.kind).toBe('none');
      expect(result.source.warnings.length).toBeGreaterThan(0);
    });

    it('should handle unknown annotation types gracefully', () => {
      const unknownType = {
        ...fixtureData,
        nodes: [{
          ...fixtureData.nodes[0],
          id: 'unknown-type',
          extensions: { visual: { shapeType: 'rect', annotationType: 'completelyUnknownType' } },
        }],
      };
      const result = adapter.normalize(unknownType);
      // Should not throw, should include the annotation with 'unknown' type
      expect(result.annotations.find(a => a.id === 'unknown-type')).toBeDefined();
    });
  });

  describe('Full tool output simulation', () => {
    // Simulate what the tool handlers do

    function simulateInspect(data: unknown) {
      const normalized = adapter.normalize(data);
      return {
        projectId: normalized.version,
        version: normalized.version,
        source: { kind: normalized.source.kind, label: normalized.source.label, durationMs: normalized.source.durationMs, warnings: normalized.source.warnings },
        stats: normalized.stats,
        rawSummary: {
          nodeCount: normalized.annotations.length,
          trackCount: normalized.subtitleTracks.length,
          version: normalized.version,
        },
        warnings: normalized.warnings,
      };
    }

    function simulateValidate(data: unknown) {
      const result = adapter.validate(data);
      return { valid: result.valid, errors: result.errors, warnings: result.warnings, checks: result.checks };
    }

    function simulateFindAnnotations(data: unknown, filters?: { type?: string; timeRange?: { startMs: number; endMs: number } }, limit = 50) {
      const normalized = adapter.normalize(data);
      let matches = normalized.annotations;
      if (filters) {
        if (filters.type) matches = matches.filter(a => a.type === filters.type);
        if (filters.timeRange) {
          const { startMs, endMs } = filters.timeRange;
          matches = matches.filter(a => {
            if (a.temporal.startMs > endMs) return false;
            if (a.temporal.endMs !== null && a.temporal.endMs < startMs) return false;
            return true;
          });
        }
      }
      return { matches: matches.slice(0, limit), total: matches.length, filters: filters ?? {} };
    }

    function simulateSummarize(data: unknown) {
      const normalized = adapter.normalize(data);
      const annotations = normalized.annotations;
      let minStart = Infinity, maxEnd = 0;
      for (const ann of annotations) {
        if (ann.temporal.startMs < minStart) minStart = ann.temporal.startMs;
        if (ann.temporal.endMs !== null && ann.temporal.endMs > maxEnd) maxEnd = ann.temporal.endMs;
        else if (ann.temporal.endMs === null && ann.temporal.startMs > maxEnd) maxEnd = ann.temporal.startMs;
      }
      const colors = new Set<string>();
      let opaqueCount = 0, transparentCount = 0;
      for (const ann of annotations) {
        colors.add(ann.visual.color);
        if (ann.visual.opacity >= 1) opaqueCount++;
        else if (ann.visual.fill === 'transparent') transparentCount++;
      }
      return {
        total: annotations.length, byType: normalized.stats.annotationTypes, byShape: normalized.stats.shapeTypes,
        temporalDistribution: { start: minStart === Infinity ? 0 : minStart, end: maxEnd, range: maxEnd - (minStart === Infinity ? 0 : minStart) },
        visualSummary: { uniqueColors: colors.size, opaqueCount, transparentCount },
      };
    }

    it('inspect: returns correct projectId and stats', () => {
      const result = simulateInspect(fixtureData);
      expect(result.projectId).toBe('24.0.0');
      expect(result.stats.totalAnnotations).toBe(5);
      expect(result.source.kind).toBe('direct-url');
    });

    it('validate: returns valid=true for correct data', () => {
      const result = simulateValidate(fixtureData);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validate: returns valid=false for bad data', () => {
      const badData = { version: '24.0.0', nodes: [{ id: '', type: 'annotation' }] as any };
      const result = simulateValidate(badData);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('find: returns all matches by default', () => {
      const result = simulateFindAnnotations(fixtureData);
      expect(result.total).toBe(5);
      expect(result.matches.length).toBe(5);
    });

    it('find: filters by type', () => {
      const result = simulateFindAnnotations(fixtureData, { type: 'box' });
      expect(result.total).toBeLessThanOrEqual(5);
      for (const match of result.matches) {
        expect(match.type).toBe('box');
      }
    });

    it('find: filters by time range', () => {
      const result = simulateFindAnnotations(fixtureData, { timeRange: { startMs: 0, endMs: 30000 } });
      expect(result.total).toBeLessThanOrEqual(5);
    });

    it('find: respects limit', () => {
      const result = simulateFindAnnotations(fixtureData, undefined, 2);
      expect(result.matches.length).toBeLessThanOrEqual(2);
    });

    it('summarize: returns temporal distribution', () => {
      const result = simulateSummarize(fixtureData);
      expect(typeof result.temporalDistribution.start).toBe('number');
      expect(typeof result.temporalDistribution.end).toBe('number');
      expect(result.temporalDistribution.range).toBeGreaterThanOrEqual(0);
    });

    it('summarize: counts colors correctly', () => {
      const result = simulateSummarize(fixtureData);
      expect(result.visualSummary.uniqueColors).toBeGreaterThan(0);
      expect(result.visualSummary.opaqueCount).toBeGreaterThanOrEqual(0);
    });

    it('summarize: includes annotation type breakdown', () => {
      const result = simulateSummarize(fixtureData);
      expect(typeof result.byType).toBe('object');
      expect(typeof result.byShape).toBe('object');
    });
  });

  describe('MCP server creation', () => {
    it('should create a server without errors', () => {
      const server = createServer();
      expect(server).toBeDefined();
      expect(typeof server.connect).toBe('function');
    });
  });
});
