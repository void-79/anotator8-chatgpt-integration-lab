# In-Process OAuth 2.1 Authorization Server (v0.7.0) + Production IdP cutover (v0.8.0)

> **Status:** v0.7.0 in-process AS implemented and verified (2026-06-07).
> v0.8.0 adds a `local | external` mode switch so the lab can
> validate tokens against a production IdP (Auth0/Okta/Cognito/Stytch/Keycloak)
> without code changes.
> **Scope:** Read-only AS for the Anotator8 ChatGPT integration lab.
> **Production use:** Switch to `MCP_OAUTH_MODE=external` and point at a real IdP — see [Cutover recipe](#cutover-recipe-production-idp).

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
| `MCP_OAUTH_MODE` | `local` | `local` (in-process AS) or `external` (validate IdP-issued JWTs) — **v0.8.0** |
| `MCP_OAUTH_IDP_ISSUER` | (empty) | Required in external mode. The IdP's `iss` claim URL. **v0.8.0** |
| `MCP_OAUTH_IDP_JWKS_URL` | (empty) | Required in external mode. The IdP's JWKS URL. **v0.8.0** |
| `MCP_OAUTH_ISSUER` | `http://${MCP_HOST}:${MCP_PORT}` | The `iss` claim and the AS metadata `issuer`. In external mode MUST equal `MCP_OAUTH_IDP_ISSUER`. |
| `MCP_OAUTH_SCOPES_SUPPORTED` | `mcp:read` | Comma-separated scopes advertised in AS metadata |
| `MCP_OAUTH_DEFAULT_SUBJECT` | `demo-user` | The `sub` claim when none is provided (local mode only) |
| `MCP_OAUTH_DEFAULT_SCOPE` | `mcp:read` | Default scope when `MCP_OAUTH_REQUIRE_AUTH=true` |
| `MCP_OAUTH_TOKEN_TTL` | `900` | Token lifetime in seconds (local mode only) |
| `MCP_OAUTH_REQUIRE_AUTH` | `false` | Force every tool to require a Bearer JWT |
| `MCP_OAUTH_CIMD_SUPPORTED` | `true` | Advertise `client_id_metadata_document_supported: true` |
| `MCP_OAUTH_CIMD_ALLOWLIST` | (empty) | Comma-separated hostnames; CIMD URLs not on this list are rejected |
| `MCP_OAUTH_ALLOW_INSECURE_HTTP` | `true` | Permit `http://` AS / CIMD URLs (dev only) |
| `MCP_OAUTH_TOOL_SCHEMES_JSON` | (empty) | Per-tool `securitySchemes` overrides as JSON |
| `MCP_AUTH_TOKEN` | (empty) | Static-token allowlist (comma-separated) |

## Test coverage

The implementation has ~86 new test cases across 9 test files (v0.7.0 + v0.8.0):

- `tests/unit/oauth/pkce.test.ts` (10)
- `tests/unit/oauth/jwks.test.ts` (8)
- `tests/unit/oauth/authorization-code-store.test.ts` (7)
- `tests/unit/oauth/authorization-server-metadata.test.ts` (7)
- `tests/unit/oauth/token-issuer.test.ts` (10)
- `tests/unit/oauth/dcr.test.ts` (9)
- `tests/unit/oauth/cimd.test.ts` (10)
- `tests/unit/oauth/security-schemes.test.ts` (9)
- `tests/integration/oauth/authorization-server.test.ts` (10)
- `tests/unit/oauth/remote-issuer.test.ts` (7) **v0.8.0**
- `tests/unit/oauth/issuer-factory.test.ts` (5) **v0.8.0**
- `tests/integration/oauth/external-mode-as-disabled.test.ts` (4) **v0.8.0**

Plus the end-to-end `npm run demo:oauth` script.

## Cutover recipe (production IdP)

### v0.8.0 — one-env-var cutover

The lab now supports a `local | external` mode switch. Cutting over
to a production IdP is a config change, not a code change.

1. **Provision the IdP** — create an API and enable RBAC with the
   scopes you need (`mcp:read`, etc.). Note:
   - The IdP's `iss` claim (from the IdP's `/.well-known/openid-configuration`).
   - The IdP's `jwks_uri` (also from the same discovery doc).
2. **Configure the lab to point at the IdP:**
   ```bash
   export MCP_OAUTH_MODE=external
   export MCP_OAUTH_IDP_ISSUER="https://your-tenant.auth0.com/"
   export MCP_OAUTH_IDP_JWKS_URL="https://your-tenant.auth0.com/.well-known/jwks.json"
   # The lab's `iss` (what /mcp advertises in the WWW-Authenticate
   # challenge and PRM `authorization_servers`) must equal the IdP's
   # `iss` in v0.8.0.
   export MCP_OAUTH_ISSUER="https://your-tenant.auth0.com/"
   # The resource (aud) is still the lab's URL.
   export MCP_OAUTH_RESOURCE="https://lab.example.com/mcp"
   ```
3. **Start the lab.** The in-process AS endpoints (`/oauth2/v1/*`,
   `/.well-known/oauth-authorization-server`, `/oauth/jwks.json`)
   automatically return `404 as_disabled`. The `/mcp` endpoint
   validates inbound Bearer tokens against the IdP's JWKS.
4. **Register your app at the IdP** as a confidential or public
   client. Use the standard authorization-code-with-PKCE flow.
5. **Have the IdP include the lab's `aud`** in issued access tokens.
   For Auth0: configure an "audience" parameter; for Okta: set
   `aud` in the authorization server's claims; for Cognito: enable
   "Generate client secret" and add a custom resource server whose
   identifier is the lab's `MCP_OAUTH_RESOURCE`.
6. **Done.** No code changes. The in-process AS stays in the
   codebase for local demos (`MCP_OAUTH_MODE=local`); the cutover
   is reversible.

#### Per-IdP snippets

**Auth0**

```bash
# After creating an API in the Auth0 dashboard (Settings → APIs):
#   Identifier: https://your-tenant.auth0.com/api/v2/   (this becomes the iss)
#   Signing Algorithm: RS256
#   Allow Skipping User Consent: false
export MCP_OAUTH_IDP_ISSUER="https://your-tenant.auth0.com/"
export MCP_OAUTH_IDP_JWKS_URL="https://your-tenant.auth0.com/.well-known/jwks.json"
# Set the lab's `iss` to the Auth0 domain (NOT the API identifier —
# Auth0 puts the domain in `iss`, not the audience).
export MCP_OAUTH_ISSUER="https://your-tenant.auth0.com/"
# The resource the lab advertises (and validates `aud` against):
export MCP_OAUTH_RESOURCE="https://lab.example.com/mcp"
# When calling /authorize, pass `audience=https://lab.example.com/mcp`.
```

**Okta**

```bash
export MCP_OAUTH_IDP_ISSUER="https://your-domain.okta.com/oauth2/default"
export MCP_OAUTH_IDP_JWKS_URL="https://your-domain.okta.com/oauth2/default/v1/keys"
export MCP_OAUTH_ISSUER="https://your-domain.okta.com/oauth2/default"
```

**Cognito**

```bash
export MCP_OAUTH_IDP_ISSUER="https://cognito-idp.<region>.amazonaws.com/<user-pool-id>"
export MCP_OAUTH_IDP_JWKS_URL="https://cognito-idp.<region>.amazonaws.com/<user-pool-id>/.well-known/jwks.json"
export MCP_OAUTH_ISSUER="https://cognito-idp.<region>.amazonaws.com/<user-pool-id>"
```

**Stytch / Keycloak** — same pattern: copy the issuer and JWKS URL
from the IdP's discovery document and set the three env vars.

#### Verifying the cutover

```bash
# 1. Confirm the in-process AS is gated:
curl -i http://localhost:8787/.well-known/oauth-authorization-server
# → 404, body: {"error":"as_disabled",...}

# 2. Mint a token from your IdP (out of scope here; do it via the IdP's
#    token endpoint or a test helper) and call /mcp:
curl -i -H "Authorization: Bearer $IDP_JWT" http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"cutover-check","version":"0"}}}'
# → 200 OK with a session-id header
```

### Pre-v0.8.0 cutover (for historical context)

Before v0.8.0, swapping the in-process AS for a production IdP
required editing `src/server/app.ts` to comment out the AS routes
and `src/server/auth.ts` to call the IdP's `/userinfo` for
`sub` extraction. That manual procedure has been superseded by the
`MCP_OAUTH_MODE=external` switch.

## Honest limitations

### Resolved in v0.8.0

- ~~**Self-signed tokens.** The lab generates its own RSA key pair.~~
  → Resolved in v0.8.0: `MCP_OAUTH_MODE=external` switches to a
  JWKS-backed `RemoteTokenValidator` that validates against any
  RS256 IdP. Key rotation is supported via forced refetch on
  `kid` miss.

### Still open in v0.8.0

- **In-memory state.** Authorization codes and registered clients
  are lost on process restart. (Local mode only. In external mode
  the IdP owns this state.)
- **No refresh tokens.** Clients re-authorize when the access token
  expires. The 15-minute TTL is short enough to be safe in a demo.
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
  hardening per the latest draft). Tracked as a v0.9.0 follow-up.
- **External mode requires the lab `iss` to equal the IdP `iss`.**
  In v0.8.0 the lab's `MCP_OAUTH_ISSUER` is the IdP's issuer URL;
  there is no separate "resource issuer" / "AS issuer" distinction
  yet. Splitting these is a v0.9.0 conversation.
- **External mode does not fetch JWKS at startup.** The first
  `/mcp` request triggers the fetch; if the IdP is down at that
  moment the first request 401s. Acceptable for a demo, but for
  production health probes should pre-warm the cache.
