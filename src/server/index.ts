/**
 * Anotator8 ChatGPT Integration Lab - MCP Server
 *
 * Architecture:
 * - Uses @modelcontextprotocol/sdk for MCP server
 * - Uses @modelcontextprotocol/ext-apps for ChatGPT Apps compatibility
 * - Implements read-only tools for Anotator8 project analysis
 * - Transport: Streamable HTTP (ChatGPT Developer Mode compatible)
 */

import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { adapter, Anotator8Adapter } from './anotator8-adapter.js';
import type { NormalizedProject, IntegrationWarning } from '../shared/types.js';
import { bearerAuth } from '../middleware/auth.js';

// ────────────────────────────────────────────────────
// Server Configuration
// ────────────────────────────────────────────────────
const SERVER_NAME = 'anotator8-chatgpt-lab';
const SERVER_VERSION = '0.1.0';

const INSTRUCTIONS = `
Anotator8 ChatGPT Integration Lab - Read-only MCP server for video annotation projects.

Capabilities:
- list_capabilities: Show all available features and limitations
- inspect_project: Analyze Anotator8 project JSON
- validate_project: Check project data consistency
- summarize_annotations: Generate annotation statistics
- find_annotations: Search/filter annotations by criteria
- create_review_plan: Generate a manual review checklist
- export_chatgpt_report: Create portable report for ChatGPT

Input: Accept Anotator8 project JSON directly in tool arguments.

Security: All tools are read-only. No file system access. No mutation.

Tools MUST be called with valid project data. Projects must be under 10MB.
`.trim();

// ────────────────────────────────────────────────────
// Tool Schemas
// ────────────────────────────────────────────────────

// list_capabilities
const listCapabilitiesOutputSchema = {
  supportedFeatures: z.array(z.string()),
  limitations: z.array(z.string()),
  annotationTypes: z.array(z.string()),
  supportedSubtitleLanguages: z.array(z.string()),
};

// inspect_project
const inspectProjectInputSchema = {
  projectData: z.unknown().describe('Anotator8 project JSON (.anatator.json format)'),
  projectId: z.string().optional().describe('Optional identifier for the project'),
};

const inspectProjectOutputSchema = {
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
};

// validate_project
const validateProjectInputSchema = {
  projectData: z.unknown().describe('Anotator8 project JSON to validate'),
};

const validateProjectOutputSchema = {
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
};

// summarize_annotations
const summarizeAnnotationsInputSchema = {
  projectData: z.unknown().describe('Anotator8 project JSON'),
};

const summarizeAnnotationsOutputSchema = {
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

// find_annotations
const findAnnotationsInputSchema = {
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
};

const findAnnotationsOutputSchema = {
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
};

// create_review_plan
const createReviewPlanInputSchema = {
  projectData: z.unknown().describe('Anotator8 project JSON'),
};

const createReviewPlanOutputSchema = {
  sections: z.array(z.object({
    title: z.string(),
    checks: z.array(z.object({
      description: z.string(),
      priority: z.enum(['high', 'medium', 'low']),
      type: z.enum(['issue', 'suggestion', 'verification']),
    })),
  })),
  estimatedTime: z.string(),
};

// export_chatgpt_report
const exportReportInputSchema = {
  projectData: z.unknown().describe('Anotator8 project JSON'),
  format: z.enum(['markdown', 'json']).default('markdown'),
  includeUnknownFields: z.boolean().default(false),
};

const exportReportOutputSchema = {
  format: z.string(),
  content: z.string(),
  filename: z.string(),
};

// ────────────────────────────────────────────────────
// Tool Handlers
// ────────────────────────────────────────────────────

function createToolResponse<T>(data: T, warnings: IntegrationWarning[] = []) {
  return {
    structuredContent: data,
    content: [{ type: 'text' as const, text: JSON.stringify(data) }],
    _meta: { warnings },
  };
}

function createErrorResponse(error: string) {
  return {
    structuredContent: { error },
    content: [{ type: 'text' as const, text: `Error: ${error}` }],
    _meta: {},
  };
}

// ────────────────────────────────────────────────────
// Server Creation
// ────────────────────────────────────────────────────
export function createServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions: INSTRUCTIONS,
      capabilities: {
        tools: { listChanged: true },
        prompts: { listChanged: false },
        resources: { listChanged: false },
        // logging: { },  // TODO: add structured logging
      },
    }
  );

  // ────────────────────────────────────────────────────
  // Tool: list_capabilities
  // ────────────────────────────────────────────────────
  registerAppTool(
    server,
    'list_capabilities',
    {
      title: 'List Anotator8 Integration Capabilities',
      description: 'Returns all supported features, limitations, and supported annotation types for the Anotator8 ChatGPT integration.',
      inputSchema: {},
      outputSchema: listCapabilitiesOutputSchema,
      annotations: { readOnlyHint: true },
      _meta: {
        ui: { resourceUri: 'ui://widget/anotator8-widget.html' },
      },
    },
    async () => {
      return createToolResponse({
        supportedFeatures: [
          'inspect_project - Analyze Anotator8 project structure',
          'validate_project - Check project data consistency',
          'summarize_annotations - Generate annotation statistics',
          'find_annotations - Search/filter annotations',
          'create_review_plan - Generate review checklist',
          'export_chatgpt_report - Create portable report',
        ],
        limitations: [
          'Read-only operations only',
          'Project data must be under 10MB',
          'No file system access',
          'No video playback or preview',
          'No direct annotation mutation',
        ],
        annotationTypes: [
          'box', 'ellipse', 'arrow', 'polygon', 'point',
          'text', 'highlight', 'comment', 'tag', 'chapter', 'image',
        ],
        supportedSubtitleLanguages: ['en', 'ru', 'kk'],
      });
    }
  );

  // ────────────────────────────────────────────────────
  // Tool: inspect_project
  // ────────────────────────────────────────────────────
  registerAppTool(
    server,
    'inspect_project',
    {
      title: 'Inspect Anotator8 Project',
      description: 'Analyze an Anotator8 project JSON and return normalized summary including video source, annotation counts, and warnings.',
      inputSchema: inspectProjectInputSchema,
      outputSchema: inspectProjectOutputSchema,
      annotations: { readOnlyHint: true },
      _meta: {
        ui: { resourceUri: 'ui://widget/anotator8-widget.html' },
      },
    },
    async ({ projectData, projectId }) => {
      try {
        const normalized = adapter.normalize(projectData);
        return createToolResponse({
          projectId: projectId ?? normalized.version,
          ...extractInspectResult(normalized),
        }, normalized.warnings);
      } catch (e) {
        return createErrorResponse(String(e));
      }
    }
  );

  // ────────────────────────────────────────────────────
  // Tool: validate_project
  // ────────────────────────────────────────────────────
  registerAppTool(
    server,
    'validate_project',
    {
      title: 'Validate Anotator8 Project',
      description: 'Check Anotator8 project data for consistency issues including missing IDs, invalid time ranges, and orphaned references.',
      inputSchema: validateProjectInputSchema,
      outputSchema: validateProjectOutputSchema,
      annotations: { readOnlyHint: true },
      _meta: {
        ui: { resourceUri: 'ui://widget/anotator8-widget.html' },
      },
    },
    async ({ projectData }) => {
      try {
        const result = adapter.validate(projectData);
        return createToolResponse({
          valid: result.valid,
          errors: result.errors,
          warnings: result.warnings,
          checks: result.checks,
        });
      } catch (e) {
        return createErrorResponse(String(e));
      }
    }
  );

  // ────────────────────────────────────────────────────
  // Tool: summarize_annotations
  // ────────────────────────────────────────────────────
  registerAppTool(
    server,
    'summarize_annotations',
    {
      title: 'Summarize Annotations',
      description: 'Generate human-readable statistics about annotation distribution by type, shape, temporal range, and visual properties.',
      inputSchema: summarizeAnnotationsInputSchema,
      outputSchema: summarizeAnnotationsOutputSchema,
      annotations: { readOnlyHint: true },
      _meta: {
        ui: { resourceUri: 'ui://widget/anotator8-widget.html' },
      },
    },
    async ({ projectData }) => {
      try {
        const normalized = adapter.normalize(projectData);
        const summary = computeSummarizeResult(normalized);
        return createToolResponse(summary, normalized.warnings);
      } catch (e) {
        return createErrorResponse(String(e));
      }
    }
  );

  // ────────────────────────────────────────────────────
  // Tool: find_annotations
  // ────────────────────────────────────────────────────
  registerAppTool(
    server,
    'find_annotations',
    {
      title: 'Find Annotations',
      description: 'Query and filter annotations by type, shape, time range, text content, or color.',
      inputSchema: findAnnotationsInputSchema,
      outputSchema: findAnnotationsOutputSchema,
      annotations: { readOnlyHint: true },
      _meta: {
        ui: { resourceUri: 'ui://widget/anotator8-widget.html' },
      },
    },
    async ({ projectData, filters, limit }) => {
      try {
        const normalized = adapter.normalize(projectData);
        const matches = filterAnnotations(normalized, filters);
        return createToolResponse({
          matches: matches.slice(0, limit),
          total: matches.length,
          filters: filters ?? {},
        });
      } catch (e) {
        return createErrorResponse(String(e));
      }
    }
  );

  // ────────────────────────────────────────────────────
  // Tool: create_review_plan
  // ────────────────────────────────────────────────────
  registerAppTool(
    server,
    'create_review_plan',
    {
      title: 'Create Review Plan',
      description: 'Generate a structured manual review checklist for the Anotator8 project.',
      inputSchema: createReviewPlanInputSchema,
      outputSchema: createReviewPlanOutputSchema,
      annotations: { readOnlyHint: true },
      _meta: {
        ui: { resourceUri: 'ui://widget/anotator8-widget.html' },
      },
    },
    async ({ projectData }) => {
      try {
        const normalized = adapter.normalize(projectData);
        const validation = adapter.validate(projectData);
        const plan = computeReviewPlan(normalized, validation);
        return createToolResponse(plan);
      } catch (e) {
        return createErrorResponse(String(e));
      }
    }
  );

  // ────────────────────────────────────────────────────
  // Tool: export_chatgpt_report
  // ────────────────────────────────────────────────────
  registerAppTool(
    server,
    'export_chatgpt_report',
    {
      title: 'Export ChatGPT Report',
      description: 'Generate a portable report (Markdown or JSON) summarizing the Anotator8 project for use in ChatGPT conversations.',
      inputSchema: exportReportInputSchema,
      outputSchema: exportReportOutputSchema,
      annotations: { readOnlyHint: true },
      _meta: {
        ui: { resourceUri: 'ui://widget/anotator8-widget.html' },
      },
    },
    async ({ projectData, format, includeUnknownFields }) => {
      try {
        const normalized = adapter.normalize(projectData);
        const validation = adapter.validate(projectData);
        const report = computeExportReport(normalized, validation, format, includeUnknownFields);
        return createToolResponse(report);
      } catch (e) {
        return createErrorResponse(String(e));
      }
    }
  );

  // ────────────────────────────────────────────────────
  // Prompts
  // ────────────────────────────────────────────────────
  server.prompt(
    'project_review',
    'Структурированный review аннотаций Anotator8 проекта. Анализирует видео-аннотации, субтитры и выдаёт рекомендации.',
    {
      projectData: z.unknown().describe('Anotator8 project JSON'),
      focus: z.enum(['all', 'annotations', 'subtitles', 'quality']).default('all').describe('Focus area for the review'),
    },
    async ({ projectData, focus }) => {
      try {
        const normalized = adapter.normalize(projectData);
        const validation = adapter.validate(projectData);

        const annotationSummary = normalized.annotations.reduce<Record<string, number>>((acc, a) => {
          acc[a.type] = (acc[a.type] ?? 0) + 1;
          return acc;
        }, {});

        const subtitleInfo = {
          tracks: normalized.subtitleTracks.length,
          cues: normalized.stats.subtitleCueCount,
          hasTemporal: normalized.stats.hasTemporalData,
        };

        let body = `## Anotator8 Project Review\n\n`;
        body += `**Version:** ${normalized.version}\n`;
        body += `**Annotations:** ${normalized.annotations.length} (${Object.entries(annotationSummary).map(([k, v]) => `${k}: ${v}`).join(', ')})\n`;
        body += `**Subtitles:** ${subtitleInfo.tracks} tracks, ${subtitleInfo.cues} cues\n`;
        body += `**Valid:** ${validation.valid ? '✅' : '❌'}\n\n`;

        if (validation.errors.length > 0) {
          body += `### Errors\n${validation.errors.map(e => `- [${e.severity}] ${e.code}: ${e.message}`).join('\n')}\n\n`;
        }
        if (validation.warnings.length > 0) {
          body += `### Warnings\n${validation.warnings.map(w => `- [${w.severity}] ${w.code}: ${w.message}`).join('\n')}\n\n`;
        }

        body += `### Quality Checks\n`;
        for (const check of validation.checks) {
          body += `- ${check.passed ? '✅' : '❌'} ${check.name}${check.message ? `: ${check.message}` : ''}\n`;
        }

        if (focus === 'annotations' || focus === 'quality') {
          body += `\n### Recommendations\n`;
          if (!validation.valid) body += `1. Fix validation errors before using this project\n`;
          if (normalized.annotations.length === 0) body += `1. Add annotations to enable video review\n`;
          if (normalized.warnings.length > 3) body += `1. Review ${normalized.warnings.length} warnings for data quality\n`;
        }

        return {
          messages: [{
            role: 'user' as const,
            content: { type: 'text' as const, text: body },
          }],
        };
      } catch {
        return {
          messages: [{
            role: 'user' as const,
            content: { type: 'text' as const, text: 'Error generating project review. Please check the project data.' },
          }],
        };
      }
    }
  );

  // ────────────────────────────────────────────────────
  // Resource Templates
  // ────────────────────────────────────────────────────
  server.resource(
    'project',
    new ResourceTemplate('project:///{projectId}', {
      list: async () => ({ resources: [] }),
      complete: {},
    }),
    {
      description: 'Read an Anotator8 project by its ID',
    },
    async (_uri: URL, variables: Record<string, string | string[]>) => {
      const projectId = variables['projectId'];
      // Template for future multi-project support
      // Currently returns a stub — real implementation would look up by projectId
      return {
        contents: [{
          uri: `project:///${projectId}`,
          mimeType: 'application/json',
          text: JSON.stringify({
            projectId,
            note: 'Project resource lookup is a stub. Pass project data directly to tools for now.',
          }),
        }],
      };
    }
  );

  // ────────────────────────────────────────────────────
  // Widget Resource
  // ────────────────────────────────────────────────────
  const widgetHtml = `
<div id="anotator8-root">
  <div class="header">
    <h2>Anotator8 Project Review</h2>
    <p class="status">Waiting for project data...</p>
  </div>
  <div class="stats" id="stats"></div>
  <div class="warnings" id="warnings"></div>
</div>
<style>
#anotator8-root { font-family: system-ui, sans-serif; padding: 16px; }
.header h2 { margin: 0 0 8px; }
.status { color: #666; font-size: 14px; }
.stats { margin-top: 16px; }
.stats-item { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #eee; }
.warnings { margin-top: 16px; }
.warning { padding: 8px; margin: 4px 0; border-radius: 4px; font-size: 13px; }
.warning.error { background: #fee; color: #c00; }
.warning.warning { background: #ffc; color: #660; }
.warning.info { background: #eef; color: #006; }
</style>
<script type="module">
const root = document.getElementById('anotator8-root');
const status = root.querySelector('.status');
const statsDiv = document.getElementById('stats');
const warningsDiv = document.getElementById('warnings');

const escape = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const update = (result) => {
  if (!result?.structuredContent) {
    status.textContent = 'No data received';
    return;
  }
  status.textContent = 'Project loaded';

  const data = result.structuredContent;

  // Render stats (text only — no HTML injection risk)
  if (data.stats) {
    statsDiv.replaceChildren();
    for (const [k, v] of Object.entries(data.stats)) {
      const row = document.createElement('div');
      row.className = 'stats-item';
      const keySpan = document.createElement('span');
      keySpan.textContent = k;
      const valSpan = document.createElement('span');
      valSpan.textContent = JSON.stringify(v);
      row.appendChild(keySpan);
      row.appendChild(valSpan);
      statsDiv.appendChild(row);
    }
  }

  // Render warnings (HTML-escaped text only)
  if (data.warnings?.length) {
    warningsDiv.replaceChildren();
    for (const w of data.warnings) {
      const div = document.createElement('div');
      div.className = 'warning ' + (w.severity ?? 'info');
      div.textContent = '[' + (w.code ?? '') + '] ' + (w.message ?? '');
      warningsDiv.appendChild(div);
    }
  }
};

window.addEventListener('message', (e) => {
  if (e.source !== window.parent) return;
  if (e.data?.method === 'ui/notifications/tool-result') {
    update(e.data.params);
  }
}, { passive: true });
</script>
  `.trim();

  registerAppResource(
    server,
    'anotator8-widget',
    'ui://widget/anotator8-widget.html',
    {},
    async () => ({
      contents: [{
        uri: 'ui://widget/anotator8-widget.html',
        mimeType: RESOURCE_MIME_TYPE,
        text: widgetHtml,
        _meta: {
          ui: {
            prefersBorder: true,
            domain: 'https://anotator8-chatgpt-integration.local',
            csp: {
              connectDomains: [],
              resourceDomains: [],
            },
          },
        },
      }],
    })
  );

  return server;
}

// ────────────────────────────────────────────────────
// Helper Functions
// ────────────────────────────────────────────────────

function extractInspectResult(normalized: NormalizedProject) {
  return {
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
  };
}

function computeSummarizeResult(normalized: NormalizedProject) {
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
    byType: normalized.stats.annotationTypes,
    byShape: normalized.stats.shapeTypes,
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

function filterAnnotations(normalized: NormalizedProject, filters?: {
  type?: string;
  shapeType?: string;
  timeRange?: { startMs: number; endMs: number };
  hasText?: boolean;
  color?: string;
}) {
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

function computeReviewPlan(normalized: NormalizedProject, validation: ReturnType<Anotator8Adapter['validate']>) {
  const sections: Array<{
    title: string;
    checks: Array<{ description: string; priority: 'high' | 'medium' | 'low'; type: 'issue' | 'suggestion' | 'verification' }>;
  }> = [];

  // Source section
  sections.push({
    title: 'Video Source Review',
    checks: [
      {
        description: 'Verify video source URL is accessible',
        priority: 'high',
        type: 'verification',
      },
      {
        description: `Source type: ${normalized.source.kind}`,
        priority: 'low' as const,
        type: 'verification',
      },
      ...(normalized.source.warnings.length > 0
        ? normalized.source.warnings.map((w) => ({
            description: `[${w.code}] ${w.message}`,
            priority: (w.severity === 'error' ? 'high' : 'medium') as 'high' | 'medium',
            type: 'issue' as const,
          }))
        : []),
    ],
  });

  // Annotations section
  sections.push({
    title: 'Annotations Review',
    checks: [
      {
        description: `Total annotations: ${normalized.stats.totalAnnotations}`,
        priority: 'low',
        type: 'verification',
      },
      {
        description: 'Check for overlapping annotations at key moments',
        priority: 'medium',
        type: 'suggestion',
      },
      {
        description: 'Verify annotation labels are descriptive',
        priority: 'low',
        type: 'suggestion',
      },
      ...(normalized.warnings.filter((w) => w.code.includes('NODE'))
        .map((w) => ({
          description: `[${w.code}] ${w.message}`,
          priority: 'medium' as const,
          type: 'issue' as const,
        }))),
    ],
  });

  // Validation issues section
  if (validation.errors.length > 0) {
    sections.push({
      title: 'Critical Issues',
      checks: validation.errors.map((e) => ({
        description: `[${e.code}] ${e.message}`,
        priority: 'high' as const,
        type: 'issue' as const,
      })),
    });
  }

  if (validation.warnings.length > 0) {
    sections.push({
      title: 'Warnings',
      checks: validation.warnings.map((w) => ({
        description: `[${w.code}] ${w.message}`,
        priority: 'medium' as const,
        type: 'suggestion' as const,
      })),
    });
  }

  // Subtitle section
  if (normalized.subtitleTracks.length > 0) {
    sections.push({
      title: 'Subtitle Tracks Review',
      checks: normalized.subtitleTracks.map((track) => ({
        description: `Track "${track.label}" (${track.language}): ${track.cueCount} cues`,
        priority: 'medium' as const,
        type: 'verification' as const,
      })),
    });
  }

  // Estimate review time
  const totalItems =
    normalized.stats.totalAnnotations +
    normalized.subtitleTracks.length +
    validation.errors.length +
    validation.warnings.length;
  const estimatedMinutes = Math.max(5, Math.ceil(totalItems / 10));

  return {
    sections,
    estimatedTime: `${estimatedMinutes}-${estimatedMinutes * 2} minutes`,
  };
}

function computeExportReport(
  normalized: NormalizedProject,
  validation: ReturnType<Anotator8Adapter['validate']>,
  format: 'markdown' | 'json',
  includeUnknownFields: boolean
) {
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
      annotations: normalized.annotations.slice(0, 100), // Limit for report
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
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `- **${k}**: ${v}`),
    ``,
    `### Shape Types`,
    ``,
    ...Object.entries(normalized.stats.shapeTypes)
      .filter(([, v]) => v > 0)
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

// ────────────────────────────────────────────────────
// Main Entry Point
// ────────────────────────────────────────────────────
export function main() {
  const server = createServer();

  // Parse environment for host/port
  const host = process.env.MCP_HOST ?? '127.0.0.1';
  const port = parseInt(process.env.MCP_PORT ?? '8787', 10);

  console.log(`Starting ${SERVER_NAME} v${SERVER_VERSION}...`);

  // Create Express app pre-configured for MCP
  const app = createMcpExpressApp({ host });

  // Store transports by session ID (required for stateful mode)
  const transports: Record<string, StreamableHTTPServerTransport> = {};

  // ── Health & Readiness Endpoints ──────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', ts: Date.now() });
  });

  app.get('/ready', (_req, res) => {
    res.json({
      status: 'ready',
      version: SERVER_VERSION,
      sessions: Object.keys(transports).length,
    });
  });

  // ── Rate Limiting ──────────────────────────────────────
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
  });

  // ── Auth middleware (applied to /mcp routes only) ─────
  // Bearer auth is optional — enabled when MCP_AUTH_TOKEN env var is set

  // POST handler — new sessions and subsequent requests
  app.post('/mcp', limiter, bearerAuth, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else {
      // New session — create transport and connect server
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          transports[sid] = transport;
        },
      });
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) delete transports[sid];
      };
      await server.connect(transport);
    }

    await transport.handleRequest(req, res, req.body);
  });

  // GET handler — SSE stream for server-to-client events
  app.get('/mcp', limiter, bearerAuth, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    await transports[sessionId].handleRequest(req, res);
  });

  // DELETE handler — terminate session
  app.delete('/mcp', limiter, bearerAuth, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    await transports[sessionId].handleRequest(req, res);
  });

  // ── Graceful Shutdown ──────────────────────────────────
  let isShuttingDown = false;
  const shutdown = (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`${signal} received, shutting down gracefully...`);
    // Close all active transports
    for (const [sid, transport] of Object.entries(transports)) {
      transport.close();
      delete transports[sid];
    }
    server.close();
    console.log('Server closed.');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  app.listen(port, () => {
    console.log(`${SERVER_NAME} v${SERVER_VERSION} listening on http://${host}:${port}`);
    console.log('MCP endpoint: POST/GET/DELETE /mcp');
    console.log('Health: GET /health');
    console.log('Ready:  GET /ready');
    if (process.env.MCP_AUTH_TOKEN) {
      console.log('Auth: Bearer token required');
    } else {
      console.log('Auth: DISABLED (set MCP_AUTH_TOKEN to enable)');
    }
  });
}
