/**
 * Tool: inspect_project
 * Analyzes an Anotator8 project JSON and returns a normalized summary.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { adapter } from '../anotator8-adapter.js';
import type { InspectProjectResult } from '../../shared/types.js';
import { toolSuccess, toolError } from './schemas.js';
import type { ToolSuccessResponse, ToolErrorResponse } from './schemas.js';

// Zod shapes for nested output structures
const warningSchema = {
  code: z.string(),
  message: z.string(),
  severity: z.string(),
};

const sourceSchema = {
  kind: z.string(),
  label: z.string().optional(),
  durationMs: z.number().optional(),
  warnings: z.array(z.object(warningSchema)),
};

const statsSchema = {
  totalAnnotations: z.number(),
  annotationTypes: z.record(z.string(), z.number()),
  shapeTypes: z.record(z.string(), z.number()),
  subtitleCueCount: z.number(),
  hasTemporalData: z.boolean(),
  hasVisualExtensions: z.boolean().optional(),
};

const rawSummarySchema = {
  nodeCount: z.number(),
  trackCount: z.number(),
  version: z.string(),
};

const outputSchema = {
  projectId: z.string(),
  version: z.string(),
  source: z.object(sourceSchema),
  stats: z.object(statsSchema),
  rawSummary: z.object(rawSummarySchema),
  warnings: z.array(z.object(warningSchema)),
};

export function registerInspectProject(server: McpServer): void {
  registerAppTool(
    server,
    'inspect_project',
    {
      title: 'Inspect Anotator8 Project',
      description:
        'Analyze an Anotator8 project JSON and return a normalized summary including video source metadata, annotation counts, subtitle tracks, and any warnings about unsupported fields.',
      inputSchema: {
        projectData: z.unknown().describe('Anotator8 project JSON (.anatator8.json format)'),
        projectId: z.string().optional().describe('Optional human-readable identifier for the project'),
      },
      outputSchema,
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: 'ui://widget/anotator8-widget.html' } },
    },
    async ({ projectData, projectId }: { projectData: unknown; projectId?: string }): Promise<ToolSuccessResponse | ToolErrorResponse> => {
      try {
        const normalized = adapter.normalize(projectData);
        return toolSuccess({
          projectId: projectId ?? normalized.version,
          version: normalized.version,
          source: {
            kind: normalized.source.kind,
            label: normalized.source.label,
            durationMs: normalized.source.durationMs,
            warnings: normalized.source.warnings,
          },
          stats: normalized.stats,
          rawSummary: {
            nodeCount: normalized.annotations.length,
            trackCount: normalized.subtitleTracks.length,
            version: normalized.version,
          },
          warnings: normalized.warnings,
        }, normalized.warnings);
      } catch (e) {
        return toolError(String(e));
      }
    }
  );
}
