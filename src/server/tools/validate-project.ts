/**
 * Tool: validate_project
 * Checks Anotator8 project data for structural consistency issues.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { adapter } from '../anotator8-adapter.js';
import type { ValidateProjectResult } from '../../shared/types.js';
import { toolSuccess, toolError } from './schemas.js';
import type { ToolSuccessResponse, ToolErrorResponse } from './schemas.js';

const warningSchema = {
  code: z.string(),
  message: z.string(),
  severity: z.string(),
};

const outputSchema = {
  valid: z.boolean(),
  errors: z.array(z.object(warningSchema)),
  warnings: z.array(z.object(warningSchema)),
  checks: z.array(z.object({
    name: z.string(),
    passed: z.boolean(),
    message: z.string().optional(),
  })),
};

export function registerValidateProject(server: McpServer): void {
  registerAppTool(
    server,
    'validate_project',
    {
      title: 'Validate Anotator8 Project',
      description:
        'Check Anotator8 project data for consistency issues including missing IDs, invalid time ranges (endTime < startTime), out-of-bounds spatial data, orphaned subtitle cues, and unknown field preservation.',
      inputSchema: {
        projectData: z.unknown().describe('Anotator8 project JSON to validate'),
      },
      outputSchema,
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: 'ui://widget/anotator8-widget.html' } },
    },
    async ({ projectData }: { projectData: unknown }): Promise<ToolSuccessResponse | ToolErrorResponse> => {
      try {
        const normalized = adapter.normalize(projectData);
        const result = adapter.validate(projectData);
        return toolSuccess(result, normalized.warnings);
      } catch (e) {
        return toolError(String(e));
      }
    }
  );
}
