/**
 * Unit tests for MCP tool schemas and response helpers
 */

import { describe, it, expect } from 'vitest';
import { toolSuccess, toolError } from '../../src/server/tools/schemas.js';
import type { IntegrationWarning } from '../../src/shared/types.js';

describe('toolSuccess', () => {
  it('should create a response with structuredContent and text fallback', () => {
    const data = { foo: 'bar', count: 42 };
    const result = toolSuccess(data);

    expect(result.structuredContent).toEqual(data);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toBe(JSON.stringify(data));
  });

  it('should include warnings in _meta when provided', () => {
    const warnings: IntegrationWarning[] = [
      { code: 'W001', message: 'Test warning', severity: 'warning' },
    ];
    const data = { result: 'ok' };
    const result = toolSuccess(data, warnings);

    expect(result._meta.warnings).toEqual(warnings);
    expect(result._meta.warnings).toHaveLength(1);
  });

  it('should default to empty warnings array', () => {
    const result = toolSuccess({ result: 'ok' });
    expect(result._meta.warnings).toEqual([]);
  });

  it('should handle null/undefined values in data', () => {
    const data = { nullable: null, missing: undefined };
    const result = toolSuccess(data);

    expect(result.structuredContent).toEqual({ nullable: null, missing: undefined });
    // JSON.stringify omits undefined values
    expect(result.content[0].text).toBe('{"nullable":null}');
  });

  it('should handle complex nested objects', () => {
    const data = {
      stats: {
        annotationTypes: { box: 5, ellipse: 2 },
        shapeTypes: { rect: 5, circle: 2 },
      },
      source: {
        kind: 'direct-url',
        warnings: [{ code: 'INFO', message: 'ok', severity: 'info' }],
      },
    };
    const result = toolSuccess(data);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.stats.annotationTypes.box).toBe(5);
  });
});

describe('toolError', () => {
  it('should create an error response with safe error message', () => {
    const result = toolError('Something went wrong');

    expect(result.structuredContent).toEqual({ error: 'Something went wrong' });
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Something went wrong');
    expect(result._meta).toEqual({});
  });

  it('should strip stack traces from error messages', () => {
    const rawError = 'Parse error\n    at parsePayload (C:\\project\\adapter.ts:47:12)\n    at normalize (C:\\project\\adapter.ts:20:5)';
    const result = toolError(rawError);

    expect(result.structuredContent.error).not.toContain('C:\\project');
    expect(result.structuredContent.error).not.toContain('at ');
    expect(result.structuredContent.error).toContain('Parse error');
  });

  it('should strip Unix paths from error messages', () => {
    const rawError = 'Error: /home/user/project/src/adapter.ts:42 in parsePayload';
    const result = toolError(rawError);

    expect(result.structuredContent.error).not.toContain('/home/user');
    expect(result.structuredContent.error).not.toContain('at ');
    expect(result.structuredContent.error).toContain('Error');
  });

  it('should handle empty error strings', () => {
    const result = toolError('');
    expect(result.structuredContent.error).toBe('');
  });

  it('should handle error messages with special characters', () => {
    const result = toolError('Expected number, got "abc"');
    expect(result.structuredContent.error).toBe('Expected number, got "abc"');
  });
});

describe('schema round-trip', () => {
  it('tool response JSON should be parseable back', () => {
    const original = {
      projectId: 'test-001',
      version: '24.0.0',
      stats: {
        totalAnnotations: 10,
        annotationTypes: { box: 5, arrow: 3, ellipse: 2 },
        shapeTypes: { rect: 5, circle: 2, arrow: 3 },
        subtitleCueCount: 3,
        hasTemporalData: true,
        hasVisualExtensions: true,
      },
      rawSummary: {
        nodeCount: 10,
        trackCount: 2,
        version: '24.0.0',
      },
      warnings: [] as IntegrationWarning[],
    };

    const response = toolSuccess(original);
    const parsed = JSON.parse(response.content[0].text);

    expect(parsed).toEqual(original);
    expect(parsed.stats.annotationTypes.box).toBe(5);
    expect(parsed.rawSummary.nodeCount).toBe(10);
  });
});
