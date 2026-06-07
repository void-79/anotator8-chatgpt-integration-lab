# In-Process OAuth 2.1 Authorization Server (v0.7.0)

> **Status:** Implemented and verified (v0.7.0, 2026-06-07).
> **Scope:** Read-only AS for the Anotator8 ChatGPT integration lab.
> **Production use:** Not intended as a production IdP. Cut over to Auth0 / Okta / Cognito / Stytch before any real-user deployment. See [Cutover recipe](#cutover-recipe-production-idp).

## What ships in v0.7.0

The lab now embeds a minimal OAuth 2.1 Authorization Server (AS) inside
`createHttpMcpApp()`. The AS is **always on** (it does not require any
environment variable to be set) so that the well-known discovery
endpoints are reachable for any client that needs them. The token
issuer is also always present, but **does not require auth by default**
— see [Auth modes](#auth-modes) for how to opt in.

Endpoints added to the lab's HTTP server:

| Method | Path | Purpose | Spec |
| --- | --- | --- | --- |
| GET | `/.well-known/oauth-authorization-server` | AS metadata (RFC 8414) | RFC 8414 §3 |
| GET | `/.well-known/openid-configuration` | Same doc, OIDC Discovery path | OIDC Discovery §4 |
| GET | `/oauth/jwks.json` | JWKS public key publication | RFC 7517 |
| GET | `/oauth2/v1/authorize` | Render consent page | RFC 6749 §4.1.1 |
| POST | `/oauth2/v1/authorize` | Consent decision (Allow/Deny) → auth code | RFC 6749 §4.1.2 |
| POST | `/oauth2/v1/token` | Code grant → JWT access token | RFC 6749 §4.1.3 |
| POST | `/oauth2/v1/register` | Dynamic client registration | RFC 7591 |

Plus, the existing `/.well-known/oauth-protected-resource` (RFC 9728)
now has the AS's metadata listed under `authorization_servers`.

## Auth modes

The lab supports three auth modes, in increasing order of strictness:

| Mode | Trigger | Behavior |
| --- | --- | --- |
| **Local demo (default)** | No `MCP_AUTH_TOKEN` and no `MCP_OAUTH_REQUIRE_AUTH=true` | Any reachable client can call all 8 read-only tools. The AS endpoints are still served (for discovery), but no token is required. |
| **Static-token** | `MCP_AUTH_TOKEN=...` is set | `Authorization: Bearer <token>` required. The token must match the comma-separated allowlist. JWTs from the AS are also accepted (validated via the issuer's signing key). |
| **Required OAuth2** | `MCP_OAUTH_REQUIRE_AUTH=true` | Every tool requires `Authorization: Bearer <JWT>`. The JWT must be issued by the in-process AS (or a future production IdP — see [Cutover recipe](#cutover-recipe-production-idp)). |

In all three modes, the AS is reachable for discovery. The auth check
for `/mcp` lives in `src/server/auth.ts`; the implementation is
documented inline in that file.

## End-to-end flow

The `npm run demo:oauth` script exercises the full flow with no
browser required (the consent decision is simulated by POSTing the
form directly). High-level:

1. Client generates a PKCE verifier + S256 challenge (RFC 7636).
2. Client POSTs to `/oauth2/v1/register` to register (or uses a CIMD
   URL as the `client_id`).
3. Client GETs `/oauth2/v1/authorize` with `response_type=code`,
   `code_challenge`, `code_challenge_method=S256`, `redirect_uri`,
   and `state`. The server returns an HTML consent page.
4. User clicks Allow → server POSTs back the same params with
   `decision=allow`. Server 302-redirects to the registered
   `redirect_uri` with `?code=...&state=...`.
5. Client POSTs to `/oauth2/v1/token` with `grant_type=authorization_code`,
   `code`, `redirect_uri`, `client_id`, and `code_verifier`. Server
   returns a JWT access token (`token_type=Bearer`, `expires_in=900`).
6. Client calls `/mcp` with `Authorization: Bearer <token>`. Server
   validates the JWT (sig + iss + aud + exp + nbf + scope) and
   forwards the request to the MCP transport.

The script asserts each step and exits non-zero on any deviation.
Run it with:

```bash
npm run demo:oauth
```

Expected output (abridged):

```
OAUTH-DEMO PASS
server url=http://127.0.0.1:56980
pkce verifier=HogUofDP... challenge=k0Zr0HakCXqh...
as issuer=http://127.0.0.1:8787 jwks=http://127.0.0.1:8787/oauth/jwks.json
jwks kid=cb9a479f-7e9a-41c3-810c-9f41e5a597b7 alg=RS256
dcr client_id=3e2b7aef-34c2-49a9-8c35-f2a587226abc
authorize GET returned 200 with consent page
authorize POST issued code=7KpBR1UZCAMW... state=demo-state
token issued expires_in=900s token=eyJhbGciOiRS...
mcp initialize server=anotator8-chatgpt-integration-lab v0.7.0
mcp tools/list returned 8 tools: list_capabilities, inspect_project, validate_project, summarize_annotations, find_annotations, suggest_labels, create_review_plan, export_chatgpt_report
auth code correctly rejected on reuse (single-use)
PKCE mismatch correctly rejected
```

## Token format

Access tokens are RS256 JWTs with the following claims:

| Claim | Value | Notes |
| --- | --- | --- |
| `iss` | `MCP_OAUTH_ISSUER` or `http://<host>:<port>` | Must match the AS's `issuer` |
| `sub` | The resource owner (default: `demo-user`) | Configurable via `MCP_OAUTH_DEFAULT_SUBJECT` |
| `aud` | The resource indicator (RFC 8707) | Defaults to the lab's `MCP_OAUTH_RESOURCE` |
| `iat` | Unix seconds, now | Set on issue |
| `nbf` | Unix seconds, now | Set on issue |
| `exp` | `iat + 900` (configurable) | Set on issue |
| `scope` | Space-separated scopes (e.g. `mcp:read`) | Joined from the auth request |
| `client_id` | The registered client identifier | CIMD URL or DCR UUID |
| `jti` | UUIDv4 | Random per token |

The lab **does not** issue refresh tokens in v0.7.0 (intentional,
documented limitation). The token TTL is 15 minutes by default; tune
with `MCP_OAUTH_TOKEN_TTL` (seconds).

## Configuration reference

| Env var | Default | Purpose |
| --- | --- | --- |
| `MCP_OAUTH_ISSUER` | `http://${MCP_HOST}:${MCP_PORT}` | The `iss` claim and the AS metadata `issuer` |
| `MCP_OAUTH_SCOPES_SUPPORTED` | `mcp:read` | Comma-separated scopes advertised in AS metadata |
| `MCP_OAUTH_DEFAULT_SUBJECT` | `demo-user` | The `sub` claim when none is provided |
| `MCP_OAUTH_DEFAULT_SCOPE` | `mcp:read` | Default scope when `MCP_OAUTH_REQUIRE_AUTH=true` |
| `MCP_OAUTH_TOKEN_TTL` | `900` | Token lifetime in seconds |
| `MCP_OAUTH_REQUIRE_AUTH` | `false` | Force every tool to require a Bearer JWT |
| `MCP_OAUTH_CIMD_SUPPORTED` | `true` | Advertise `client_id_metadata_document_supported: true` |
| `MCP_OAUTH_CIMD_ALLOWLIST` | (empty) | Comma-separated hostnames; CIMD URLs not on this list are rejected |
| `MCP_OAUTH_ALLOW_INSECURE_HTTP` | `true` | Permit `http://` AS / CIMD URLs (dev only) |
| `MCP_OAUTH_TOOL_SCHEMES_JSON` | (empty) | Per-tool `securitySchemes` overrides as JSON |
| `MCP_AUTH_TOKEN` | (empty) | Static-token allowlist (comma-separated) |

## Test coverage

The implementation has ~70 new test cases across 7 test files:

- `tests/unit/oauth/pkce.test.ts` (10)
- `tests/unit/oauth/jwks.test.ts` (8)
- `tests/unit/oauth/authorization-code-store.test.ts` (7)
- `tests/unit/oauth/authorization-server-metadata.test.ts` (7)
- `tests/unit/oauth/token-issuer.test.ts` (10)
- `tests/unit/oauth/dcr.test.ts` (9)
- `tests/unit/oauth/cimd.test.ts` (10)
- `tests/unit/oauth/security-schemes.test.ts` (9)
- `tests/integration/oauth/authorization-server.test.ts` (10)

Plus the end-to-end `npm run demo:oauth` script.

## Cutover recipe (production IdP)

To swap the in-process AS for a production IdP (e.g. Auth0):

1. **Provision the IdP** — create an API and enable RBAC with the
   scopes you need (`mcp:read`, etc.).
2. **Set `MCP_OAUTH_ISSUER`** to the IdP's issuer URL.
3. **Set `MCP_OAUTH_RESOURCE`** to the lab's resource URL.
4. **Override the AS routes** — in `src/server/app.ts`, comment out
   the `asHandlers.handle(req, res, url)` dispatch. Replace with a
   passthrough that 404s the in-process AS routes so clients are
   forced to use the IdP.
5. **Update `src/server/auth.ts`** to call the IdP's `/userinfo` (or
   equivalent) for `sub` extraction, instead of the in-process
   `TokenIssuer.validate`.
6. **Update the tests** that assert the in-process AS endpoints
   exist (`tests/integration/oauth/authorization-server.test.ts`,
   `scripts/oauth-demo.ts`). They become "AS external" tests that
   hit the IdP's endpoints.
7. **Document the migration** in `docs/CHATGPT_APP_SETUP.md` under
   the "Connect a production IdP" section.

## Honest limitations (v0.7.0)

These are intentional for a self-contained lab. None block a demo
flow.

- **In-memory state.** Authorization codes and registered clients
  are lost on process restart. The JWT signing key is regenerated,
  so any in-flight tokens become invalid. A process restart
  effectively forces re-authorization.
- **No refresh tokens.** Clients re-authorize when the access token
  expires. The 15-minute TTL is short enough to be safe in a demo.
- **Self-signed tokens.** The lab generates its own RSA key pair. No
  certificate chain, no key rotation. A real IdP must be used for
  any non-demo deployment.
- **No consent audit.** The consent page POSTs `decision=allow` and
  the lab always grants. A real IdP records the user's decision.
- **The `code_challenge_method` is `S256` only.** RFC 7636 allows
  `plain`, but the lab refuses it.
- **The consent page has no user list.** All requests are issued to
  `MCP_OAUTH_DEFAULT_SUBJECT` (default `demo-user`). A real IdP
  authenticates the user.
- **CIMD is partially implemented.** The resolver validates the
  document and caches it, but does not verify that the CIMD URL
  itself appears in the `redirect_uris` list (a recommended
  hardening per the latest draft).
