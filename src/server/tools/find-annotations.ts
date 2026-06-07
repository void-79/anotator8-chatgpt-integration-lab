/**
 * Tool: find_annotations
 * Query and filter annotations by type, shape, time range, text content, or color.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { adapter } from '../anotator8-adapter.js';
import type { NormalizedProject } from '../../shared/types.js';
import { toolSuccess, toolError } from './schemas.js';
import type { ToolSuccessResponse, ToolErrorResponse } from './schemas.js';

const annotationSchema = {
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
};

const outputSchema = {
  matches: z.array(z.object(annotationSchema)),
  total: z.number(),
  filters: z.record(z.unknown()),
};

export function registerFindAnnotations(server: McpServer): void {
  registerAppTool(
    server,
    'find_annotations',
    {
      title: 'Find Annotations',
      description:
        'Query and filter annotations by type (box, ellipse, arrow, etc.), shape type (rect, circle, etc.), time range (startMs/endMs), whether they contain text, or specific color.',
      inputSchema: {
        projectData: z.unknown().describe('Anotator8 project JSON'),
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
      },
      outputSchema,
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: 'ui://widget/anotator8-widget.html' } },
    },
    async ({
      projectData,
      filters,
      limit,
    }: {
      projectData: unknown;
      filters?: {
        type?: string;
        shapeType?: string;
        timeRange?: { startMs: number; endMs: number };
        hasText?: boolean;
        color?: string;
      };
      limit?: number;
    }): Promise<ToolSuccessResponse | ToolErrorResponse> => {
      try {
        const normalized = adapter.normalize(projectData);
        const matches = filterAnnotations(normalized, filters);
        const safeLimit = Math.min(Math.max(1, limit ?? 50), 100);
        return toolSuccess({
          matches: matches.slice(0, safeLimit),
          total: matches.length,
          filters: filters ?? {},
        });
      } catch (e) {
        return toolError(String(e));
      }
    }
  );
}

function filterAnnotations(
  normalized: NormalizedProject,
  filters?: {
    type?: string;
    shapeType?: string;
    timeRange?: { startMs: number; endMs: number };
    hasText?: boolean;
    color?: string;
  }
) {
  if (!filters) return normalized.annotations;

  return normalized.annotations.filter((ann) => {
    if (filters.type && ann.type !== filters.type) return false;
    if (filters.shapeType && ann.shapeType !== filters.shapeType) return false;
    if (filters.hasText !== undefined) {
      const hasText = !!ann.text;
      if (filters.hasText !== hasText) return false;
    }
    if (filters.color && ann.visual.color !== filters.color) return false;
    if (filters.timeRange) {
      const { startMs, endMs } = filters.timeRange;
      if (ann.temporal.startMs > endMs) return false;
      if (ann.temporal.endMs !== null && ann.temporal.endMs < startMs) return false;
    }
    return true;
  });
}
