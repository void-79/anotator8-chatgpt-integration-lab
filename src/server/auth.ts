import type { IncomingMessage, ServerResponse } from "node:http";
import { buildBearerChallenge, wellKnownUrlForResource, type OAuthFoundationConfig } from "./oauth/protected-resource-metadata.js";

const LEGACY_REALM = "anotator8-chatgpt-lab";

/**
 * RFC 6750 Bearer auth — DEMO-GRADE.
 *
 * If MCP_AUTH_TOKEN is unset, the server runs in "local demo" mode
 * where any reachable client can call all 8 read-only tools. The
 * `index.ts` entrypoint screams a 7-line ASCII banner about this.
 *
 * If MCP_AUTH_TOKEN is set, the comma-separated list of tokens is the
 * allowlist. Missing or wrong tokens get 401/403 with `WWW-Authenticate:
 * Bearer realm="..."` per RFC 6750 §3.
 *
 * When an `OAuthFoundationConfig` is provided, the 401 challenge ALSO
 * carries `resource_metadata="<well-known url>"` per RFC 9728 §5.1, so
 * clients can dynamically discover the protected resource metadata.
 */
export function requireBearerAuth(
  req: IncomingMessage,
  res: ServerResponse,
  oauthConfig?: OAuthFoundationConfig,
): boolean {
  const expected = process.env.MCP_AUTH_TOKEN?.trim();
  if (!expected) return true;

  const metadataUrl = oauthConfig?.includeResourceMetadataInChallenge
    ? wellKnownUrlForResource(oauthConfig.resource)
    : undefined;

  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.writeHead(401, {
      "content-type": "application/json",
      "WWW-Authenticate": buildBearerChallenge({
        realm: LEGACY_REALM,
        metadataUrl,
        error: "invalid_request",
        errorDescription: "Missing Bearer access token",
      }),
    });
    res.end(JSON.stringify({ error: "Missing Bearer token" }));
    return false;
  }

  const allowed = new Set(expected.split(",").map((token) => token.trim()).filter(Boolean));
  if (!allowed.has(header.slice("Bearer ".length))) {
    res.writeHead(403, {
      "content-type": "application/json",
      "WWW-Authenticate": buildBearerChallenge({
        realm: LEGACY_REALM,
        metadataUrl,
        error: "invalid_token",
        errorDescription: "Bearer access token is not valid for this resource",
      }),
    });
    res.end(JSON.stringify({ error: "Invalid Bearer token" }));
    return false;
  }

  return true;
}
