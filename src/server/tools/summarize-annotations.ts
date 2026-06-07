/**
 * Tool: summarize_annotations
 * Generates statistics about annotation distribution by type, shape, temporal range, and color.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { adapter } from '../anotator8-adapter.js';
import type { NormalizedProject, SummarizeAnnotationsResult } from '../../shared/types.js';
import { toolSuccess, toolError } from './schemas.js';
import type { ToolSuccessResponse, ToolErrorResponse } from './schemas.js';

const outputSchema = {
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
};

export function registerSummarizeAnnotations(server: McpServer): void {
  registerAppTool(
    server,
    'summarize_annotations',
    {
      title: 'Summarize Annotations',
      description:
        'Generate human-readable statistics about annotation distribution: count by type (box, ellipse, etc.), count by shape (rect, circle, etc.), temporal range (earliest to latest start time), and visual properties (unique colors, opacity distribution).',
      inputSchema: {
        projectData: z.unknown().describe('Anotator8 project JSON'),
      },
      outputSchema,
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: 'ui://widget/anotator8-widget.html' } },
    },
    async ({ projectData }: { projectData: unknown }): Promise<ToolSuccessResponse | ToolErrorResponse> => {
      try {
        const normalized = adapter.normalize(projectData);
        const summary = computeSummarizeResult(normalized);
        return toolSuccess(summary, normalized.warnings);
      } catch (e) {
        return toolError(String(e));
      }
    }
  );
}

function computeSummarizeResult(normalized: NormalizedProject): SummarizeAnnotationsResult {
  const annotations = normalized.annotations;

  // Temporal distribution
  let minStart = Infinity;
  let maxEnd = 0;
  for (const ann of annotations) {
    if (ann.temporal.startMs < minStart) minStart = ann.temporal.startMs;
    if (ann.temporal.endMs !== null && ann.temporal.endMs > maxEnd) {
      maxEnd = ann.temporal.endMs;
    } else if (ann.temporal.endMs === null && ann.temporal.startMs > maxEnd) {
      maxEnd = ann.temporal.startMs;
    }
  }

  // Visual summary
  const colors = new Set<string>();
  let opaqueCount = 0;
  let transparentCount = 0;
  for (const ann of annotations) {
    colors.add(ann.visual.color);
    if (ann.visual.opacity >= 1) opaqueCount++;
    else if (ann.visual.fill === 'transparent') transparentCount++;
  }

  return {
    total: annotations.length,
    byType: normalized.stats.annotationTypes as Record<string, number>,
    byShape: normalized.stats.shapeTypes as Record<string, number>,
    temporalDistribution: {
      start: minStart === Infinity ? 0 : minStart,
      end: maxEnd,
      range: maxEnd - (minStart === Infinity ? 0 : minStart),
    },
    visualSummary: {
      uniqueColors: colors.size,
      opaqueCount,
      transparentCount,
    },
  };
}
