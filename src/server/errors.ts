import type { IntegrationErrorCode, IntegrationErrorShape } from "../shared/types.js";

export class IntegrationError extends Error {
  readonly code: IntegrationErrorCode;
  readonly path?: string;

  constructor(code: IntegrationErrorCode, message: string, path?: string) {
    super(message);
    this.name = "IntegrationError";
    this.code = code;
    this.path = path;
  }

  toShape(): IntegrationErrorShape {
    return {
      code: this.code,
      message: this.message,
      ...(this.path ? { path: this.path } : {}),
    };
  }
}

export function toIntegrationError(error: unknown): IntegrationError {
  if (error instanceof IntegrationError) return error;
  if (error instanceof Error) return new IntegrationError("internal_error", error.message);
  return new IntegrationError("internal_error", String(error));
}
