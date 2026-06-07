/**
 * Tool: create_review_plan
 * Generates a structured manual review checklist for the Anotator8 project.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { adapter } from '../anotator8-adapter.js';
import type { ReviewPlanResult } from '../../shared/types.js';
import { toolSuccess, toolError } from './schemas.js';
import type { ToolSuccessResponse, ToolErrorResponse } from './schemas.js';

const checkSchema = z.object({
  description: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  type: z.enum(['issue', 'suggestion', 'verification']),
});

const outputSchema = {
  sections: z.array(z.object({
    title: z.string(),
    checks: z.array(checkSchema),
  })),
  estimatedTime: z.string(),
};

export function registerCreateReviewPlan(server: McpServer): void {
  registerAppTool(
    server,
    'create_review_plan',
    {
      title: 'Create Review Plan',
      description:
        'Generate a structured manual review checklist for the Anotator8 project. Sections cover video source verification, annotation review, validation issues, and subtitle track review.',
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
        const validation = adapter.validate(projectData);
        const plan = computeReviewPlan(normalized, validation);
        return toolSuccess(plan);
      } catch (e) {
        return toolError(String(e));
      }
    }
  );
}

interface CheckItem {
  description: string;
  priority: 'high' | 'medium' | 'low';
  type: 'issue' | 'suggestion' | 'verification';
}

interface Section {
  title: string;
  checks: CheckItem[];
}

function computeReviewPlan(
  normalized: ReturnType<typeof adapter.normalize>,
  validation: ReturnType<typeof adapter.validate>
): ReviewPlanResult {
  // Use mutable arrays for construction (readonly in the result type)
  const sections: Section[] = [];

  // Source section
  const sourceChecks: CheckItem[] = [
    {
      description: 'Verify video source URL is accessible',
      priority: 'high',
      type: 'verification',
    },
    {
      description: `Source type: ${normalized.source.kind}`,
      priority: 'low',
      type: 'verification',
    },
  ];
  for (const w of normalized.source.warnings) {
    sourceChecks.push({
      description: `[${w.code}] ${w.message}`,
      priority: w.severity === 'error' ? 'high' : 'medium',
      type: 'issue',
    });
  }
  sections.push({ title: 'Video Source Review', checks: sourceChecks });

  // Annotations section
  const annotationChecks: CheckItem[] = [
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
  ];
  for (const w of normalized.warnings.filter((w) => w.code.includes('NODE'))) {
    annotationChecks.push({
      description: `[${w.code}] ${w.message}`,
      priority: 'medium',
      type: 'issue',
    });
  }
  sections.push({ title: 'Annotations Review', checks: annotationChecks });

  // Critical issues
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

  // Warnings
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

  // Cast to readonly result type
  return {
    sections: sections as readonly Section[],
    estimatedTime: `${estimatedMinutes}-${estimatedMinutes * 2} minutes`,
  };
}
