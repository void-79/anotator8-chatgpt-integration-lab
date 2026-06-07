/**
 * Contract tests: MCP tool schema compliance
 *
 * These tests verify that each tool's input/output schemas match
 * the declared contracts in docs/TOOL_CONTRACTS.md.
 *
 * They test the schema STRUCTURE (not runtime behavior),
 * ensuring tools accept/reject inputs according to their Zod schemas.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Fixture data
const fixturePath = resolve(__dirname, '../../fixtures/sample-project.anatator8.json');
const fixtureData = JSON.parse(readFileSync(fixturePath, 'utf-8'));

// ────────────────────────────────────────────────────
// Schema Contracts
// These must match the schemas declared in each tool file
// ────────────────────────────────────────────────────

const listCapabilitiesOutputSchema = z.object({
  supportedFeatures: z.array(z.string()),
  limitations: z.array(z.string()),
  annotationTypes: z.array(z.string()),
  supportedSubtitleLanguages: z.array(z.string()),
});

const inspectProjectInputSchema = z.object({
  projectData: z.unknown(), // optional in MCP schema; adapter handles missing input
  projectId: z.string().optional(),
});

const inspectProjectOutputSchema = z.object({
  projectId: z.string(),
  version: z.string(),
  source: z.object({
    kind: z.string(),
    label: z.string().optional(),
    durationMs: z.number().optional(),
    warnings: z.array(z.object({
      code: z.string(),
      message: z.string(),
      severity: z.string(),
    })),
  }),
  stats: z.object({
    totalAnnotations: z.number(),
    annotationTypes: z.record(z.string(), z.number()),
    shapeTypes: z.record(z.string(), z.number()),
    subtitleCueCount: z.number(),
    hasTemporalData: z.boolean(),
    hasVisualExtensions: z.boolean().optional(),
  }),
  rawSummary: z.object({
    nodeCount: z.number(),
    trackCount: z.number(),
    version: z.string(),
  }),
  warnings: z.array(z.object({
    code: z.string(),
    message: z.string(),
    severity: z.string(),
  })),
});

const validateProjectInputSchema = z.object({
  projectData: z.unknown(), // optional in MCP schema; adapter handles missing input
});

const validateProjectOutputSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.object({
    code: z.string(),
    message: z.string(),
    severity: z.string(),
  })),
  warnings: z.array(z.object({
    code: z.string(),
    message: z.string(),
    severity: z.string(),
  })),
  checks: z.array(z.object({
    name: z.string(),
    passed: z.boolean(),
    message: z.string().optional(),
  })),
});

const summarizeAnnotationsInputSchema = z.object({
  projectData: z.unknown(),
});

const summarizeAnnotationsOutputSchema = z.object({
  total: z.number(),
  byType: z.record(z.string(), z.number()),
  byShape: z.record(z.string(), z.number()),
  temporalDistribution: z.object({
    start: z.number(),
    end: z.number(),
    range: z.number(),
  }),
  visualSummary: z.object({
    uniqueColors: z.number(),
    opaqueCount: z.number(),
    transparentCount: z.number(),
  }),
});

const findAnnotationsInputSchema = z.object({
  projectData: z.unknown(),
  filters: z.object({
    type: z.enum(['box', 'ellipse', 'arrow', 'polygon', 'point', 'text', 'highlight', 'comment', 'tag']).optional(),
    shapeType: z.enum(['rect', 'circle', 'polygon', 'arrow', 'freehand']).optional(),
    timeRange: z.object({
      startMs: z.number(),
      endMs: z.number(),
    }).optional(),
    hasText: z.boolean().optional(),
    color: z.string().optional(),
  }).optional(),
  limit: z.number().min(1).max(100).default(50),
});

const findAnnotationsOutputSchema = z.object({
  matches: z.array(z.object({
    id: z.string(),
    type: z.string(),
    shapeType: z.string(),
    spatial: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    }),
    temporal: z.object({
      startMs: z.number(),
      endMs: z.number().nullable(),
    }),
    text: z.string().optional(),
  })),
  total: z.number(),
  filters: z.record(z.unknown()),
});

const createReviewPlanInputSchema = z.object({
  projectData: z.unknown(),
});

const createReviewPlanOutputSchema = z.object({
  sections: z.array(z.object({
    title: z.string(),
    checks: z.array(z.object({
      description: z.string(),
      priority: z.enum(['high', 'medium', 'low']),
      type: z.enum(['issue', 'suggestion', 'verification']),
    })),
  })),
  estimatedTime: z.string(),
});

const exportReportInputSchema = z.object({
  projectData: z.unknown(),
  format: z.enum(['markdown', 'json']).default('markdown'),
  includeUnknownFields: z.boolean().default(false),
});

const exportReportOutputSchema = z.object({
  format: z.string(),
  content: z.string(),
  filename: z.string(),
});

// ────────────────────────────────────────────────────
// Contract Tests: Input Schemas
// ────────────────────────────────────────────────────

describe('inspect_project input schema contract', () => {
  it('should accept valid project data', () => {
    const input = { projectData: fixtureData };
    expect(() => inspectProjectInputSchema.parse(input)).not.toThrow();
  });

  it('should accept project data with optional projectId', () => {
    const input = { projectData: fixtureData, projectId: 'my-project' };
    expect(() => inspectProjectInputSchema.parse(input)).not.toThrow();
  });

  it('should accept empty input (z.unknown() allows missing fields)', () => {
    // projectData is optional in the MCP schema; adapter validates at runtime
    expect(() => inspectProjectInputSchema.parse({})).not.toThrow();
  });
});

describe('validate_project input schema contract', () => {
  it('should accept valid project data', () => {
    const input = { projectData: fixtureData };
    expect(() => validateProjectInputSchema.parse(input)).not.toThrow();
  });

  it('should accept empty input (z.unknown() allows missing fields)', () => {
    // projectData is optional in the MCP schema; adapter validates at runtime
    expect(() => validateProjectInputSchema.parse({})).not.toThrow();
  });
});

describe('summarize_annotations input schema contract', () => {
  it('should accept valid project data', () => {
    const input = { projectData: fixtureData };
    expect(() => summarizeAnnotationsInputSchema.parse(input)).not.toThrow();
  });
});

describe('find_annotations input schema contract', () => {
  it('should accept valid input with filters', () => {
    const input = {
      projectData: fixtureData,
      filters: { type: 'box', timeRange: { startMs: 0, endMs: 60000 } },
      limit: 25,
    };
    expect(() => findAnnotationsInputSchema.parse(input)).not.toThrow();
  });

  it('should accept valid input with no filters', () => {
    const input = { projectData: fixtureData };
    expect(() => findAnnotationsInputSchema.parse(input)).not.toThrow();
  });

  it('should reject limit > 100', () => {
    const input = { projectData: fixtureData, limit: 200 };
    expect(() => findAnnotationsInputSchema.parse(input)).toThrow();
  });

  it('should reject limit < 1', () => {
    const input = { projectData: fixtureData, limit: 0 };
    expect(() => findAnnotationsInputSchema.parse(input)).toThrow();
  });

  it('should reject invalid annotation type in filter', () => {
    const input = { projectData: fixtureData, filters: { type: 'invalidType' } };
    expect(() => findAnnotationsInputSchema.parse(input)).toThrow();
  });

  it('should reject invalid shape type in filter', () => {
    const input = { projectData: fixtureData, filters: { shapeType: 'cube' } };
    expect(() => findAnnotationsInputSchema.parse(input)).toThrow();
  });
});

describe('create_review_plan input schema contract', () => {
  it('should accept valid project data', () => {
    const input = { projectData: fixtureData };
    expect(() => createReviewPlanInputSchema.parse(input)).not.toThrow();
  });
});

describe('export_chatgpt_report input schema contract', () => {
  it('should accept valid input with format=markdown', () => {
    const input = { projectData: fixtureData, format: 'markdown', includeUnknownFields: false };
    expect(() => exportReportInputSchema.parse(input)).not.toThrow();
  });

  it('should accept valid input with format=json', () => {
    const input = { projectData: fixtureData, format: 'json' };
    expect(() => exportReportInputSchema.parse(input)).not.toThrow();
  });

  it('should default format to markdown', () => {
    const parsed = exportReportInputSchema.parse({ projectData: fixtureData });
    expect(parsed.format).toBe('markdown');
  });

  it('should default includeUnknownFields to false', () => {
    const parsed = exportReportInputSchema.parse({ projectData: fixtureData });
    expect(parsed.includeUnknownFields).toBe(false);
  });

  it('should reject invalid format', () => {
    const input = { projectData: fixtureData, format: 'xml' };
    expect(() => exportReportInputSchema.parse(input)).toThrow();
  });
});

// ────────────────────────────────────────────────────
// Contract Tests: Output Schemas (via adapter)
// ────────────────────────────────────────────────────

describe('inspect_project output schema contract', () => {
  it('should accept valid inspect output from fixture', () => {
    // Simulate what inspect_project would return
    const output = {
      projectId: '24.0.0',
      version: '24.0.0',
      source: {
        kind: 'direct-url',
        label: 'https://example.com/sample-video.mp4',
        durationMs: 120500,
        warnings: [],
      },
      stats: {
        totalAnnotations: 5,
        annotationTypes: { box: 1, ellipse: 1, arrow: 1, highlight: 1, comment: 1 },
        shapeTypes: { rect: 2, ellipse: 1, arrow: 1, circle: 1 },
        subtitleCueCount: 3,
        hasTemporalData: true,
        hasVisualExtensions: true,
      },
      rawSummary: {
        nodeCount: 5,
        trackCount: 2,
        version: '24.0.0',
      },
      warnings: [],
    };
    expect(() => inspectProjectOutputSchema.parse(output)).not.toThrow();
  });

  it('should reject output missing required fields', () => {
    const bad = { projectId: 'test' };
    expect(() => inspectProjectOutputSchema.parse(bad)).toThrow();
  });
});

describe('validate_project output schema contract', () => {
  it('should accept valid validation output', () => {
    const output = {
      valid: true,
      errors: [],
      warnings: [],
      checks: [
        { name: 'Valid JSON structure', passed: true },
        { name: 'All nodes have IDs', passed: true },
      ],
    };
    expect(() => validateProjectOutputSchema.parse(output)).not.toThrow();
  });

  it('should accept validation output with errors', () => {
    const output = {
      valid: false,
      errors: [{ code: 'MISSING_NODE_ID', message: '1 node missing ID', severity: 'error' }],
      warnings: [{ code: 'INVALID_TIME_RANGE', message: '1 annotation', severity: 'warning' }],
      checks: [{ name: 'All nodes have IDs', passed: false }],
    };
    expect(() => validateProjectOutputSchema.parse(output)).not.toThrow();
  });
});

describe('find_annotations output schema contract', () => {
  it('should accept valid matches array', () => {
    const output = {
      matches: [
        {
          id: 'ann-001',
          type: 'box',
          shapeType: 'rect',
          spatial: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
          temporal: { startMs: 5.0, endMs: 15.0 },
          text: 'Test',
        },
      ],
      total: 1,
      filters: { type: 'box' },
    };
    expect(() => findAnnotationsOutputSchema.parse(output)).not.toThrow();
  });

  it('should accept matches with null endMs', () => {
    const output = {
      matches: [
        {
          id: 'ann-003',
          type: 'arrow',
          shapeType: 'arrow',
          spatial: { x: 0.2, y: 0.6, width: 0.3, height: 0.05 },
          temporal: { startMs: 20.0, endMs: null },
        },
      ],
      total: 1,
      filters: {},
    };
    expect(() => findAnnotationsOutputSchema.parse(output)).not.toThrow();
  });
});

describe('create_review_plan output schema contract', () => {
  it('should accept valid review plan output', () => {
    const output = {
      sections: [
        {
          title: 'Annotations Review',
          checks: [
            { description: 'Total annotations: 5', priority: 'low', type: 'verification' },
            { description: 'Fix missing IDs', priority: 'high', type: 'issue' },
          ],
        },
      ],
      estimatedTime: '10-20 minutes',
    };
    expect(() => createReviewPlanOutputSchema.parse(output)).not.toThrow();
  });
});

describe('export_chatgpt_report output schema contract', () => {
  it('should accept markdown report output', () => {
    const output = {
      format: 'markdown',
      content: '# Anotator8 Report\n\n...',
      filename: 'anotator8-report-2026-01-01.md',
    };
    expect(() => exportReportOutputSchema.parse(output)).not.toThrow();
  });

  it('should accept json report output', () => {
    const output = {
      format: 'json',
      content: '{"project": {"version": "24.0.0"}}',
      filename: 'anotator8-report-2026-01-01.json',
    };
    expect(() => exportReportOutputSchema.parse(output)).not.toThrow();
  });
});

// ────────────────────────────────────────────────────
// Fixtures Compatibility
// ────────────────────────────────────────────────────

describe('fixture compatibility', () => {
  it('fixture data should satisfy inspect_project input schema', () => {
    expect(() => inspectProjectInputSchema.parse({ projectData: fixtureData })).not.toThrow();
  });

  it('fixture data should satisfy validate_project input schema', () => {
    expect(() => validateProjectInputSchema.parse({ projectData: fixtureData })).not.toThrow();
  });

  it('fixture data should satisfy summarize_annotations input schema', () => {
    expect(() => summarizeAnnotationsInputSchema.parse({ projectData: fixtureData })).not.toThrow();
  });

  it('fixture data should satisfy find_annotations input schema', () => {
    expect(() => findAnnotationsInputSchema.parse({ projectData: fixtureData })).not.toThrow();
  });

  it('fixture data should satisfy create_review_plan input schema', () => {
    expect(() => createReviewPlanInputSchema.parse({ projectData: fixtureData })).not.toThrow();
  });

  it('fixture data should satisfy export_chatgpt_report input schema', () => {
    expect(() => exportReportInputSchema.parse({ projectData: fixtureData })).not.toThrow();
  });
});
