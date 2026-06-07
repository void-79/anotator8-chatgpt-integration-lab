/**
 * Tool: export_chatgpt_report
 * Generates a portable Markdown or JSON report summarizing the Anotator8 project.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { adapter } from '../anotator8-adapter.js';
import type { ExportReportResult } from '../../shared/types.js';
import { toolSuccess, toolError } from './schemas.js';
import type { ToolSuccessResponse, ToolErrorResponse } from './schemas.js';

const outputSchema = {
  format: z.string(),
  content: z.string(),
  filename: z.string(),
};

export function registerExportChatGPTTReport(server: McpServer): void {
  registerAppTool(
    server,
    'export_chatgpt_report',
    {
      title: 'Export ChatGPT Report',
      description:
        'Generate a portable report (Markdown or JSON) summarizing the Anotator8 project. The Markdown format is human-readable for copy-paste into ChatGPT; JSON is machine-readable for programmatic use.',
      inputSchema: {
        projectData: z.unknown().describe('Anotator8 project JSON'),
        format: z.enum(['markdown', 'json']).default('markdown'),
        includeUnknownFields: z.boolean().default(false),
      },
      outputSchema,
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: 'ui://widget/anotator8-widget.html' } },
    },
    async ({
      projectData,
      format,
      includeUnknownFields,
    }: {
      projectData: unknown;
      format?: 'markdown' | 'json';
      includeUnknownFields?: boolean;
    }): Promise<ToolSuccessResponse | ToolErrorResponse> => {
      try {
        const normalized = adapter.normalize(projectData);
        const validation = adapter.validate(projectData);
        const report = computeExportReport(normalized, validation, format ?? 'markdown', includeUnknownFields ?? false);
        return toolSuccess(report);
      } catch (e) {
        return toolError(String(e));
      }
    }
  );
}

function computeExportReport(
  normalized: ReturnType<typeof adapter.normalize>,
  validation: ReturnType<typeof adapter.validate>,
  format: 'markdown' | 'json',
  includeUnknownFields: boolean
): ExportReportResult {
  const timestamp = new Date().toISOString();
  const filename = `anotator8-report-${timestamp.split('T')[0]}.${format}`;

  if (format === 'json') {
    const report = {
      generated: timestamp,
      project: {
        version: normalized.version,
        source: normalized.source,
        stats: normalized.stats,
        metadata: normalized.metadata,
      },
      validation: {
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
      },
      annotations: normalized.annotations.slice(0, 100),
      ...(includeUnknownFields ? { unknownFields: normalized.unknownFields } : {}),
    };
    return {
      format: 'json',
      content: JSON.stringify(report, null, 2),
      filename,
    };
  }

  // Markdown format
  const md = [
    `# Anotator8 Project Report`,
    ``,
    `**Generated:** ${timestamp}`,
    `**Version:** ${normalized.version}`,
    ``,
    `## Video Source`,
    ``,
    `| Property | Value |`,
    `|----------|-------|`,
    `| Kind | ${normalized.source.kind} |`,
    `| Label | ${normalized.source.label ?? 'N/A'} |`,
    `| Duration | ${normalized.source.durationMs ? `${normalized.source.durationMs}ms` : 'Unknown'} |`,
    ``,
    `## Statistics`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total Annotations | ${normalized.stats.totalAnnotations} |`,
    `| Subtitle Cues | ${normalized.stats.subtitleCueCount} |`,
    `| Subtitle Tracks | ${normalized.subtitleTracks.length} |`,
    `| Has Temporal Data | ${normalized.stats.hasTemporalData ? 'Yes' : 'No'} |`,
    ``,
    `### Annotation Types`,
    ``,
    ...Object.entries(normalized.stats.annotationTypes)
      .filter(([, v]) => (v as number) > 0)
      .map(([k, v]) => `- **${k}**: ${v}`),
    ``,
    `### Shape Types`,
    ``,
    ...Object.entries(normalized.stats.shapeTypes)
      .filter(([, v]) => (v as number) > 0)
      .map(([k, v]) => `- **${k}**: ${v}`),
    ``,
    `## Validation`,
    ``,
    `**Status:** ${validation.valid ? '✅ Valid' : '❌ Invalid'}`,
    ``,
    ...(validation.errors.length > 0
      ? [
          `### Errors`,
          ``,
          ...validation.errors.map((e) => `- **[${e.code}]** ${e.message}`),
          ``,
        ]
      : []),
    ``,
    ...(validation.warnings.length > 0
      ? [
          `### Warnings`,
          ``,
          ...validation.warnings.map((w) => `- **[${w.code}]** ${w.message}`),
          ``,
        ]
      : []),
    ``,
    `## Validation Checks`,
    ``,
    ...validation.checks.map(
      (c) => `| ${c.passed ? '✅' : '❌'} | ${c.name} | ${c.message ?? ''} |`
    ),
    ``,
  ].join('\n');

  return {
    format: 'markdown',
    content: md,
    filename,
  };
}
