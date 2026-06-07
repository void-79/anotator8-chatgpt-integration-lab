/**
 * MCP Prompt: project_review
 * Structured review of Anotator8 annotations, subtitles, and quality checks.
 * Language: Russian (matches Anotator8 user base).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { adapter } from '../anotator8-adapter.js';

export function registerPrompts(server: McpServer): void {
  server.prompt(
    'project_review',
    'Структурированный review аннотаций Anotator8 проекта. Анализирует видео-аннотации, субтитры и выдаёт рекомендации.',
    {
      projectData: z.unknown().describe('Anotator8 project JSON'),
      focus: z
        .enum(['all', 'annotations', 'subtitles', 'quality'])
        .default('all')
        .describe('Focus area for the review'),
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
          body += `### Errors\n${validation.errors.map((e) => `- [${e.severity}] ${e.code}: ${e.message}`).join('\n')}\n\n`;
        }
        if (validation.warnings.length > 0) {
          body += `### Warnings\n${validation.warnings.map((w) => `- [${w.severity}] ${w.code}: ${w.message}`).join('\n')}\n\n`;
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
          messages: [{ role: 'user' as const, content: { type: 'text' as const, text: body } }],
        };
      } catch {
        return {
          messages: [
            {
              role: 'user' as const,
              content: {
                type: 'text' as const,
                text: 'Error generating project review. Please check the project data.',
              },
            },
          ],
        };
      }
    }
  );
}
