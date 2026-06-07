/**
 * src/server/oauth/as-handlers.ts
 *
 * Authorization-server request handlers. These are wired into the
 * lab's HTTP MCP app (createHttpMcpApp) in app.ts.
 *
 * Endpoints exposed:
 *   GET  /.well-known/oauth-authorization-server
 *   GET  /.well-known/openid-configuration
 *   GET  /oauth/jwks.json
 *   GET  /oauth2/v1/authorize
 *   POST /oauth2/v1/authorize          (consent decision)
 *   POST /oauth2/v1/token
 *   POST /oauth2/v1/register
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";
import {
  buildAuthorizationServerMetadata,
  writeAuthorizationServerMetadataResponse,
  type AuthorizationServerConfig,
} from "./authorization-server-metadata.js";
import { AuthorizationCodeStore } from "./authorization-code-store.js";
import { renderConsentPage } from "./consent-page.js";
import { createTokenIssuer, TokenValidationError, type TokenIssuer } from "./token-issuer.js";
import { ClientRegistry, DcrValidationError } from "./dcr.js";
import { CimdResolver, CimdResolveError } from "./cimd.js";
import { codeChallengeS256, generateCodeVerifier, verifyCodeChallenge } from "./pkce.js";
import { audit } from "../audit.js";

export interface AsHandlerDeps {
  readonly asConfig: AuthorizationServerConfig;
  readonly tokenIssuer: TokenIssuer;
  readonly codeStore: AuthorizationCodeStore;
  readonly clientRegistry: ClientRegistry;
  readonly cimdResolver: CimdResolver;
  /** The lab's resource identifier (RFC 8707). Matches the PRM's `resource`. */
  readonly resource: string;
  /** Default subject for the demo user. */
  readonly defaultSubject: string;
}

export interface AsHandlerResult {
  readonly handled: boolean;
  /** When `handled` is false, the caller should continue routing. */
}

/**
 * Top-level AS dispatcher. Returns `handled: true` if the request
 * matched an AS route and was fully served.
 */
export async function handleAsRequest(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  deps: AsHandlerDeps,
): Promise<AsHandlerResult> {
  const path = url.pathname;
  if (req.method === "GET" && (path === "/.well-known/oauth-authorization-server" || path === "/.well-known/openid-configuration")) {
    return { handled: serveAsMetadata(res, deps) };
  }
  if (req.method === "GET" && path === "/oauth/jwks.json") {
    return { handled: serveJwks(res, deps) };
  }
  if (path === "/oauth2/v1/authorize") {
    if (req.method === "GET") return { handled: await serveAuthorizeGet(req, res, url, deps) };
    if (req.method === "POST") return { handled: await serveAuthorizePost(req, res, url, deps) };
    return { handled: sendJson(res, 405, { error: "method_not_allowed" }) };
  }
  if (req.method === "POST" && path === "/oauth2/v1/token") {
    return { handled: await serveToken(req, res, deps) };
  }
  if (req.method === "POST" && path === "/oauth2/v1/register") {
    return { handled: await serveRegister(req, res, deps) };
  }
  return { handled: false };
}

// -- handlers ---------------------------------------------------------------

function serveAsMetadata(res: ServerResponse, deps: AsHandlerDeps): boolean {
  const doc = buildAuthorizationServerMetadata(deps.asConfig);
  writeAuthorizationServerMetadataResponse(res, doc);
  return true;
}

function serveJwks(res: ServerResponse, deps: AsHandlerDeps): boolean {
  res.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "public, max-age=300",
    "access-control-allow-origin": "*",
  });
  res.end(JSON.stringify(deps.tokenIssuer.jwks));
  return true;
}

async function serveAuthorizeGet(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  deps: AsHandlerDeps,
): Promise<boolean> {
  const params = url.searchParams;
  const responseType = params.get("response_type");
  const clientId = params.get("client_id");
  const redirectUri = params.get("redirect_uri");
  const scope = params.get("scope") ?? "mcp:read";
  const state = params.get("state") ?? undefined;
  const codeChallenge = params.get("code_challenge");
  const codeChallengeMethod = params.get("code_challenge_method") ?? "S256";
  const resource = params.get("resource") ?? undefined;

  const validationError = validateAuthorizeParams({
    responseType, clientId, redirectUri, codeChallenge, codeChallengeMethod, resource,
  });
  if (validationError) {
    return sendJson(res, 400, validationError);
  }
  // Validate redirect_uri against the registered client.
  try {
    await assertClientRedirect(clientId!, redirectUri!, deps);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return sendJson(res, 400, { error: "invalid_client", error_description: message });
  }
  // Render the consent page. The user clicks Allow/Deny, which POSTs back.
  const html = renderConsentPage(
    {
      clientId: clientId!,
      redirectUri: redirectUri!,
      scope: scope.split(/\s+/).filter(Boolean),
      state,
      codeChallenge: codeChallenge!,
      codeChallengeMethod: "S256",
      resource,
      subject: deps.defaultSubject,
    },
    "/oauth2/v1/authorize",
  );
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(html);
  return true;
}

async function serveAuthorizePost(
  req: IncomingMessage,
  res: ServerResponse,
  _url: URL,
  deps: AsHandlerDeps,
): Promise<boolean> {
  const body = await readFormBody(req);
  const decision = body.get("decision") ?? "deny";
  const clientId = body.get("client_id") ?? "";
  const redirectUri = body.get("redirect_uri") ?? "";
  const scope = body.get("scope") ?? "mcp:read";
  const state = body.get("state") ?? "";
  const codeChallenge = body.get("code_challenge") ?? "";
  const codeChallengeMethod = body.get("code_challenge_method") ?? "S256";
  const resource = body.get("resource") || undefined;

  if (decision === "deny") {
    return redirectWithError(res, redirectUri, "access_denied", "User denied the request", state);
  }
  const validationError = validateAuthorizeParams({
    responseType: "code", clientId, redirectUri, codeChallenge, codeChallengeMethod, resource,
  });
  if (validationError) {
    return sendJson(res, 400, validationError);
  }
  try {
    await assertClientRedirect(clientId, redirectUri, deps);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return sendJson(res, 400, { error: "invalid_client", error_description: message });
  }
  const code = deps.codeStore.create({
    clientId,
    redirectUri,
    scope: scope.split(/\s+/).filter(Boolean),
    codeChallenge,
    codeChallengeMethod: "S256",
    resource,
    subject: deps.defaultSubject,
  });
  audit({ tool: "oauth-authorize", status: "ok", summary: `issued code for client=${clientId} scope=${scope}` });
  return redirectWithCode(res, redirectUri, code.code, state);
}

async function serveToken(req: IncomingMessage, res: ServerResponse, deps: AsHandlerDeps): Promise<boolean> {
  const body = await readFormBody(req);
  const grantType = body.get("grant_type");
  if (grantType !== "authorization_code") {
    return sendJson(res, 400, { error: "unsupported_grant_type", error_description: "Only authorization_code is supported" });
  }
  const code = body.get("code");
  const redirectUri = body.get("redirect_uri");
  const clientId = body.get("client_id");
  const codeVerifier = body.get("code_verifier");
  const resource = body.get("resource") || undefined;
  if (!code || !redirectUri || !clientId || !codeVerifier) {
    return sendJson(res, 400, { error: "invalid_request", error_description: "Missing required parameter" });
  }
  // Resolve the client registration (CIMD URL or DCR id).
  let clientReg;
  try {
    clientReg = await resolveClient(clientId, deps);
  } catch (error) {
    if (error instanceof CimdResolveError) {
      return sendJson(res, 400, { error: "invalid_client", error_description: error.message });
    }
    return sendJson(res, 400, { error: "invalid_client", error_description: (error as Error).message });
  }
  if (!clientReg) {
    return sendJson(res, 400, { error: "invalid_client", error_description: "Unknown client_id" });
  }
  if (!clientReg.redirect_uris.includes(redirectUri)) {
    return sendJson(res, 400, { error: "invalid_request", error_description: "redirect_uri does not match registered URI" });
  }
  const codeRecord = deps.codeStore.consume(code, clientId, redirectUri);
  if (!codeRecord) {
    return sendJson(res, 400, { error: "invalid_grant", error_description: "Authorization code is unknown, expired, or already used" });
  }
  // PKCE S256 check.
  if (!verifyCodeChallenge(codeVerifier, codeRecord.codeChallenge, "S256")) {
    return sendJson(res, 400, { error: "invalid_grant", error_description: "PKCE code_verifier did not match code_challenge" });
  }
  // RFC 8707: resource must match the one in the auth request.
  if (codeRecord.resource && resource && codeRecord.resource !== resource) {
    return sendJson(res, 400, { error: "invalid_target", error_description: "Resource mismatch between authorization and token request" });
  }
  const effectiveResource = codeRecord.resource ?? resource ?? deps.resource;
  const issued = deps.tokenIssuer.issue({
    clientId,
    scope: codeRecord.scope,
    resource: effectiveResource,
    subject: codeRecord.subject,
  });
  audit({ tool: "oauth-token", status: "ok", summary: `issued access token for client=${clientId} scope=${codeRecord.scope.join(" ")}` });
  return sendJson(res, 200, {
    access_token: issued.token,
    token_type: "Bearer",
    expires_in: deps.tokenIssuer.config.tokenTtlSeconds,
    scope: codeRecord.scope.join(" "),
  });
}

async function serveRegister(req: IncomingMessage, res: ServerResponse, deps: AsHandlerDeps): Promise<boolean> {
  const body = await readJsonBody(req);
  try {
    const registration = deps.clientRegistry.register(body as never);
    audit({ tool: "oauth-register", status: "ok", summary: `registered client=${registration.client_id}` });
    return sendJson(res, 201, registration);
  } catch (error) {
    if (error instanceof DcrValidationError) {
      return sendJson(res, 400, { error: error.code, error_description: error.message });
    }
    throw error;
  }
}

// -- helpers ----------------------------------------------------------------

interface AuthorizeParams {
  readonly responseType: string | null;
  readonly clientId: string | null;
  readonly redirectUri: string | null;
  readonly codeChallenge: string | null;
  readonly codeChallengeMethod: string | null;
  readonly resource: string | null | undefined;
}

function validateAuthorizeParams(p: AuthorizeParams): { error: string; error_description: string } | null {
  if (p.responseType !== "code") {
    return { error: "unsupported_response_type", error_description: "Only response_type=code is supported" };
  }
  if (!p.clientId) return { error: "invalid_request", error_description: "Missing client_id" };
  if (!p.redirectUri) return { error: "invalid_request", error_description: "Missing redirect_uri" };
  if (!p.codeChallenge) return { error: "invalid_request", error_description: "Missing code_challenge (PKCE required)" };
  if (p.codeChallengeMethod !== "S256") {
    return { error: "invalid_request", error_description: "Only code_challenge_method=S256 is supported" };
  }
  if (p.resource !== null && p.resource !== undefined && p.resource !== "") {
    let parsed: URL;
    try { parsed = new URL(p.resource); } catch { return { error: "invalid_target", error_description: "resource is not a valid URL" }; }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { error: "invalid_target", error_description: "resource must be http(s)" };
    }
  }
  return null;
}

async function assertClientRedirect(clientId: string, redirectUri: string, deps: AsHandlerDeps): Promise<void> {
  const reg = await resolveClient(clientId, deps);
  if (!reg) throw new Error("Unknown client_id");
  if (!reg.redirect_uris.includes(redirectUri)) {
    throw new Error("redirect_uri does not match registered URI");
  }
}

async function resolveClient(clientId: string, deps: AsHandlerDeps): Promise<Awaited<ReturnType<typeof deps.cimdResolver.resolve>> | ReturnType<typeof deps.clientRegistry.get>> {
  // CIMD pattern: client_id is an HTTPS URL.
  if (clientId.startsWith("https://") || clientId.startsWith("http://")) {
    return deps.cimdResolver.resolve(clientId);
  }
  // DCR pattern: client_id is a UUID registered locally.
  const reg = deps.clientRegistry.get(clientId);
  if (reg) return reg;
  throw new Error(`Unknown client_id: ${clientId}`);
}

function redirectWithCode(res: ServerResponse, redirectUri: string, code: string, state: string | undefined | ""): boolean {
  const url = new URL(redirectUri);
  url.searchParams.set("code", code);
  if (state) url.searchParams.set("state", state);
  res.writeHead(302, { location: url.toString(), "cache-control": "no-store" });
  res.end();
  return true;
}

function redirectWithError(res: ServerResponse, redirectUri: string, error: string, description: string, state: string | undefined | ""): boolean {
  if (!redirectUri) {
    return sendJson(res, 400, { error, error_description: description });
  }
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  url.searchParams.set("error_description", description);
  if (state) url.searchParams.set("state", state);
  res.writeHead(302, { location: url.toString(), "cache-control": "no-store" });
  res.end();
  return true;
}

async function readFormBody(req: IncomingMessage): Promise<URLSearchParams> {
  const text = await readBodyText(req);
  return new URLSearchParams(text);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const text = await readBodyText(req);
  if (!text) return {};
  return JSON.parse(text);
}

async function readBodyText(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(res: ServerResponse, status: number, body: unknown): boolean {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
  return true;
}

// -- factory ----------------------------------------------------------------

export interface AsHandlerBundle extends AsHandlerDeps {
  readonly handle: (req: IncomingMessage, res: ServerResponse, url: URL) => Promise<AsHandlerResult>;
}

export function createAsHandlers(options: {
  asConfig: AuthorizationServerConfig;
  resource: string;
  defaultSubject: string;
  tokenTtlSeconds: number;
  cimdAllowInsecureHttp: boolean;
  cimdAllowlistHostnames: ReadonlyArray<string>;
}): AsHandlerBundle {
  const tokenIssuer = createTokenIssuer({
    issuer: stripTrailingSlash(options.asConfig.issuer),
    resource: options.resource,
    tokenTtlSeconds: options.tokenTtlSeconds,
    defaultSubject: options.defaultSubject,
  });
  const codeStore = new AuthorizationCodeStore();
  const clientRegistry = new ClientRegistry({ allowInsecureHttp: options.cimdAllowInsecureHttp });
  const cimdResolver = new CimdResolver({
    allowInsecureHttp: options.cimdAllowInsecureHttp,
    allowlistHostnames: options.cimdAllowlistHostnames,
  });
  const deps: AsHandlerDeps = {
    asConfig: options.asConfig,
    tokenIssuer,
    codeStore,
    clientRegistry,
    cimdResolver,
    resource: options.resource,
    defaultSubject: options.defaultSubject,
  };
  return {
    ...deps,
    handle: (req, res, url) => handleAsRequest(req, res, url, deps),
  };
}

function stripTrailingSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

// Public re-exports used by tests / oauth-demo script.
export { TokenValidationError, generateCodeVerifier, codeChallengeS256 };
