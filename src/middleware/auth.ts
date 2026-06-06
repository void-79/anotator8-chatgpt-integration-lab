/**
 * Bearer Token Authentication Middleware
 * Implements minimal auth for MCP remote servers (OAuth 2.1 compatible).
 * When MCP_AUTH_TOKEN is set, all /mcp requests require a valid Bearer token.
 */

import type { Request, Response, NextFunction } from 'express';

const validTokens = new Set<string>(
  process.env.MCP_AUTH_TOKEN ? process.env.MCP_AUTH_TOKEN.split(',').map(t => t.trim()) : []
);

export function bearerAuth(req: Request, res: Response, next: NextFunction): void {
  // Skip auth if no token is configured
  if (validTokens.size === 0) {
    next();
    return;
  }

  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="mcp"');
    res.status(401).json({ error: 'Missing Bearer token' });
    return;
  }

  const token = header.slice(7);
  if (!validTokens.has(token)) {
    res.status(403).json({ error: 'Invalid token' });
    return;
  }

  next();
}
