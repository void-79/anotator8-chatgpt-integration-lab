import type { IncomingMessage, ServerResponse } from "node:http";

export function requireBearerAuth(req: IncomingMessage, res: ServerResponse): boolean {
  const expected = process.env.MCP_AUTH_TOKEN?.trim();
  if (!expected) return true;

  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.writeHead(401, {
      "content-type": "application/json",
      "WWW-Authenticate": 'Bearer realm="anotator8-chatgpt-lab"',
    });
    res.end(JSON.stringify({ error: "Missing Bearer token" }));
    return false;
  }

  const allowed = new Set(expected.split(",").map((token) => token.trim()).filter(Boolean));
  if (!allowed.has(header.slice("Bearer ".length))) {
    res.writeHead(403, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid Bearer token" }));
    return false;
  }

  return true;
}
