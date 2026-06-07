/**
 * Tool: list_capabilities
 * Returns all supported features, limitations, and annotation types.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { toolSuccess } from './schemas.js';
import type { ToolSuccessResponse } from './schemas.js';

// Plain Zod shape for output — Record<string, ZodType>, NOT z.object(...)
const outputSchema = {
  supportedFeatures: z.array(z.string()),
  limitations: z.array(z.string()),
  annotationTypes: z.array(z.string()),
  supportedSubtitleLanguages: z.array(z.string()),
};

function getCapabilities() {
  return {
    supportedFeatures: [
      'normalize_anotator8_project',
      'validate_project_structure',
      'compute_annotation_statistics',
      'filter_annotations_by_type',
      'filter_annotations_by_time_range',
      'filter_annotations_by_color',
      'generate_review_plan',
      'export_as_markdown',
      'export_as_json',
      'read_only_operations',
    ],
    limitations: [
      'write_operations_not_supported',
      'requires_user_consent_for_data_access',
      '10mb_max_input_size',
      'subnet_restricted_access',
    ],
    annotationTypes: [
      'box',
      'ellipse',
      'arrow',
      'polygon',
      'point',
      'text',
      'highlight',
      'comment',
      'tag',
    ],
    supportedSubtitleLanguages: [
      'en',
      'zh',
      'ja',
      'ko',
      'es',
      'fr',
      'de',
      'ru',
      'ar',
    ],
  };
}

export function registerListCapabilities(server: McpServer): void {
  registerAppTool(
    server,
    'list_capabilities',
    {
      title: 'List Anotator8 Integration Capabilities',
      description:
        'Returns all supported features, limitations, and supported annotation types for the Anotator8 ChatGPT integration.',
      inputSchema: {},
      outputSchema,
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: 'ui://widget/anotator8-widget.html' } },
    },
    async (): Promise<ToolSuccessResponse> => {
      return toolSuccess(getCapabilities());
    }
  );
}
