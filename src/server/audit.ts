export interface AuditEvent {
  readonly tool: string;
  readonly status: "ok" | "error";
  readonly summary: string;
  readonly at: string;
}

function redact(summary: string): string {
  return summary
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/g, "Bearer [redacted]")
    .replace(/MCP_AUTH_TOKEN=[^\s]+/g, "MCP_AUTH_TOKEN=[redacted]");
}

export function audit(event: Omit<AuditEvent, "at">): void {
  const payload: AuditEvent = {
    ...event,
    summary: redact(event.summary).slice(0, 500),
    at: new Date().toISOString(),
  };
  process.stderr.write(`[audit] ${JSON.stringify(payload)}\n`);
}
