/**
 * Shared helpers for MCP tool responses.
 * These functions return the exact shape expected by the MCP SDK callback:
 * { [x: string]: unknown, content: [...], _meta: {...}, structuredContent?: {...} }
 */

import type { IntegrationWarning } from '../../shared/types.js';

/** Success response returned by all tool handlers */
export interface ToolSuccessResponse {
  [key: string]: unknown;
  structuredContent: Record<string, unknown>;
  content: Array<{ type: 'text'; text: string }>;
  _meta: { warnings: IntegrationWarning[] };
}

/** Error response returned on tool failure */
export interface ToolErrorResponse {
  [key: string]: unknown;
  structuredContent: { error: string };
  content: Array<{ type: 'text'; text: string }>;
  _meta: Record<string, never>;
}

/**
 * Wrap tool result data into the standard success response shape.
 */
export function toolSuccess(
  data: object,
  warnings: IntegrationWarning[] = []
): ToolSuccessResponse {
  return {
    structuredContent: data as Record<string, unknown>,
    content: [{ type: 'text' as const, text: JSON.stringify(data) }],
    _meta: { warnings },
  };
}

/**
 * Create an error response — never includes internal details (paths, stack traces).
 */
export function toolError(error: string): ToolErrorResponse {
  const safeError = error
    .replace(/\s+at\s+.*/g, '')
    .replace(/C:\\[^:\s]+:[0-9]+/g, '<internal>')
    .replace(/\/[^:\s]+:[0-9]+/g, '<internal>')
    .trim();

  return {
    structuredContent: { error: safeError },
    content: [{ type: 'text' as const, text: `Error: ${safeError}` }],
    _meta: {},
  };
}
