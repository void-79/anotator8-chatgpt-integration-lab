import type { IncomingMessage, ServerResponse } from "node:http";
import { buildBearerChallenge, wellKnownUrlForResource, type OAuthFoundationConfig } from "./oauth/protected-resource-metadata.js";
import { TokenValidationError, type TokenValidator, type ValidatedToken } from "./oauth/token-issuer.js";
import { requiredScopesFor, schemeForTool, toolRequiresAuth, type SecuritySchemesConfig } from "./oauth/security-schemes.js";

const LEGACY_REALM = "anotator8-chatgpt-lab";

/**
 * MCP tool-call auth. Three behaviors, in order of precedence:
 *
 *  1. **JWT mode** (when a `TokenValidator` is passed in and the request
 *     carries a Bearer token): validate the JWT (signature, iss, aud,
 *     exp, nbf, scope). On failure respond 401/403 with
 *     `WWW-Authenticate: Bearer ...` per RFC 6750 §3. The error is
 *     wrapped in the JSON body so the client can render a useful
 *     message. The validator may be the in-process local issuer
 *     (sync) or a remote IdP-backed validator (async — fetches JWKS).
 *
 *  2. **Static-token mode** (when `MCP_AUTH_TOKEN` env is set and no
 *     `TokenValidator` is present): check the Bearer token against the
 *     comma-separated allowlist. Preserves the v0.6.0 demo behavior.
 *
 *  3. **Local demo mode** (neither set): any request is allowed through.
 *     The `index.ts` entrypoint prints a 7-line banner about this.
 *
 * Per-tool `securitySchemes` (when `securitySchemes` is set) further
 * restrict access. If a tool requires `oauth2:mcp:read` but the
 * token lacks it, respond 403 with `error="insufficient_scope"`.
 *
 * On any auth failure, the response also includes
 * `_meta["mcp/www_authenticate"]` for SDKs that prefer the structured
 * form. (We include it as a header here; the tool-result envelope
 * helper in oauth-tool-result.ts adds it to MCP tool-call responses.)
 */
export interface AuthCheckResult {
  readonly ok: boolean;
  /** When ok=false, the WWW-Authenticate header value. */
  readonly challenge?: string;
  /** When ok=true and a token was validated, the validated claims. */
  readonly validated?: ValidatedToken;
}

export async function checkAuth(
  req: IncomingMessage,
  oauthConfig: OAuthFoundationConfig | undefined,
  securitySchemes: SecuritySchemesConfig | undefined,
  validator: TokenValidator | undefined,
  toolName: string | undefined,
): Promise<AuthCheckResult> {
  // Determine whether the call requires auth.
  // - `MCP_OAUTH_REQUIRE_AUTH=true` forces every tool to require auth.
  // - `MCP_AUTH_TOKEN` env forces static-token auth.
  // - Otherwise, the per-tool security scheme decides.
  const hasStaticToken = !!process.env.MCP_AUTH_TOKEN?.trim();
  const requireAuth = (securitySchemes?.requireAuth ?? false);
  const toolScheme = toolName && securitySchemes ? schemeForTool(securitySchemes, toolName) : undefined;
  const toolNeedsAuth = toolScheme ? toolRequiresAuth(toolScheme) : false;
  const mustAuthenticate = requireAuth || hasStaticToken || toolNeedsAuth;

  // Local demo mode: no auth required and no Bearer presented → allow.
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : undefined;
  if (!mustAuthenticate && !token) {
    return { ok: true };
  }
  if (!token) {
    return {
      ok: false,
      challenge: buildChallenge("invalid_request", "Missing Bearer access token", oauthConfig),
    };
  }

  // 1) JWT validation (always try first when a TokenValidator exists).
  const expectedStatic = process.env.MCP_AUTH_TOKEN?.trim();
  if (validator) {
    let required: ReadonlyArray<string> = [];
    if (toolScheme) required = requiredScopesFor(toolScheme);
    try {
      const validated = await validator.validate(token, required);
      return { ok: true, validated };
    } catch (error) {
      if (error instanceof TokenValidationError) {
        // A static token is also configured? Try it as a fallback.
        if (expectedStatic) {
          const allowed = new Set(expectedStatic.split(",").map((t) => t.trim()).filter(Boolean));
          if (allowed.has(token)) return { ok: true };
        }
        // Otherwise report the JWT-specific challenge.
        const rfc6750 = mapToRfc6750(error.code);
        return { ok: false, challenge: buildChallenge(rfc6750, error.message, oauthConfig) };
      }
      // Not a TokenValidationError — fall through to the static-token check.
    }
  }

  // 2) Static-token mode.
  if (expectedStatic) {
    const allowed = new Set(expectedStatic.split(",").map((t) => t.trim()).filter(Boolean));
    if (allowed.has(token)) return { ok: true };
    return {
      ok: false,
      challenge: buildChallenge("invalid_token", "Bearer access token is not valid for this resource", oauthConfig),
    };
  }

  // 3) No static token, no JWT validator present, and no auth required → allow
  //    (a Bearer was presented but nobody asked us to check it).
  if (!mustAuthenticate) return { ok: true };

  // 4) Fallback: deny.
  return { ok: false, challenge: buildChallenge("invalid_token", "Bearer access token is required", oauthConfig) };
}

/**
 * Back-compat: the v0.6.0 `requireBearerAuth` is preserved for the
 * pre-AS HTTP path. New callers should use `checkAuth`.
 */
export async function requireBearerAuth(
  req: IncomingMessage,
  res: ServerResponse,
  oauthConfig?: OAuthFoundationConfig,
): Promise<boolean> {
  const result = await checkAuth(req, oauthConfig, undefined, undefined, undefined);
  if (result.ok) return true;
  sendChallenge(res, 401, result.challenge!, { error: "Missing or invalid Bearer token" });
  return false;
}

function buildChallenge(
  error: "invalid_request" | "invalid_token" | "insufficient_scope",
  description: string,
  oauthConfig: OAuthFoundationConfig | undefined,
): string {
  return buildBearerChallenge({
    realm: LEGACY_REALM,
    metadataUrl: oauthConfig?.includeResourceMetadataInChallenge ? wellKnownUrlForResource(oauthConfig.resource) : undefined,
    error,
    errorDescription: description,
  });
}

function sendChallenge(res: ServerResponse, status: number, challenge: string, body: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json",
    "WWW-Authenticate": challenge,
  });
  res.end(JSON.stringify(body));
}

function mapToRfc6750(code: "invalid_token" | "insufficient_scope" | "invalid_audience" | "invalid_issuer" | "expired" | "not_yet_valid" | "malformed"): "invalid_request" | "invalid_token" | "insufficient_scope" {
  if (code === "invalid_audience" || code === "invalid_issuer" || code === "expired" || code === "not_yet_valid" || code === "malformed") {
    return "invalid_token";
  }
  return code;
}
