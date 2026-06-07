# OAuth 2.1 Authorization Server — Design (Anotator8 × ChatGPT Lab)

> **Status:** design only — implementation does not start until this doc is approved.
> **Author session:** 2026-06-07.
> **Lab version target:** v0.7.0 (next minor after v0.6.0).
> **Evidence classification:** every requirement in the table below is sourced from
> OFFICIAL_DOC_EVIDENCE (cited). Any INFERENCE is called out explicitly.

## Why this exists

The lab currently ships an **OAuth 2.0 Protected Resource Metadata foundation**
(RFC 9728, since v0.3.0) but **does not implement an authorization server**. The
MCP authorization spec (2025-11-25) and the OpenAI Apps SDK Auth doc both
require the lab to either (a) point at a real AS (Auth0, Okta, Cognito, Stytch)
or (b) operate its own AS for local demos. This design covers the second
option for in-lab demos; the first option is documented in
`docs/CHATGPT_APP_SETUP.md` § "Production Auth Gap".

## Spec requirements (cross-referenced)

| # | Requirement | Source | Status today |
| --- | --- | --- | --- |
| 1 | Protected resource metadata at `/.well-known/oauth-protected-resource[/<path>]` (RFC 9728) | MCP 2025-11-25 § [auth]; OpenAI Apps SDK Auth | DONE (v0.3.0) — `src/server/oauth/protected-resource-metadata.ts` |
| 2 | 401 `WWW-Authenticate` challenge with `resource_metadata` (RFC 9728 §5.1) | MCP + OpenAI | DONE (v0.3.0) — `buildBearerChallenge()` |
| 3 | AS metadata at `/.well-known/oauth-authorization-server` (RFC 8414) or `/.well-known/openid-configuration` | MCP 2025-11-25 § "Authorization Server Metadata" | NOT DONE |
| 4 | Authorization-code + PKCE (S256) flow | OpenAI Apps SDK Auth § "Support the authorization-code flow" | NOT DONE |
| 5 | Token endpoint that mints RS256 JWTs (or opaque tokens + introspection) | OpenAI Apps SDK Auth | NOT DONE |
| 6 | Echo `resource` parameter (RFC 8707) into the token's `aud` claim | OpenAI Apps SDK Auth § "Echo the `resource` parameter throughout the OAuth flow" | NOT DONE |
| 7 | PKCE `S256` verification on token exchange | OpenAI § "code_challenge_methods_supported" | NOT DONE |
| 8 | Token endpoint auth methods: `none` (CIMD public client) and/or `private_key_jwt` (CIMD signed assertion) | OpenAI § "token_endpoint_auth_methods_supported" | NOT DONE |
| 9 | `client_id_metadata_document_supported: true` (CIMD) | OpenAI § "Client registration" (preferred) | NOT DONE |
| 10 | DCR endpoint at `registration_endpoint` (RFC 7591) | OpenAI § "DCR is still supported" (back-compat) | NOT DONE |
| 11 | JWKS publication for self-signed tokens | OpenAI § "Implementing token verification" | NOT DONE |
| 12 | Token validation: signature, `iss`, `aud`, `exp`, `nbf`, scope | OpenAI § "Implementing token verification" | NOT DONE (replaced by static `MCP_AUTH_TOKEN` allowlist in v0.3.0) |
| 13 | Per-tool `securitySchemes` (each tool declares `noauth` or `oauth2` with scopes) | OpenAI § "Triggering authentication UI" + TypeScript SDK example | NOT DONE |
| 14 | On missing/insufficient token, the tool result must include `_meta["mcp/www_authenticate"]` to trigger ChatGPT's linking UI | OpenAI § "Triggering authentication UI" | NOT DONE |
| 15 | `WWW-Authenticate` 401 with `error="insufficient_scope"` on scope mismatch | MCP 2025-11-25 § "Handling insufficient scope" | PARTIAL — only `invalid_request` / `invalid_token` today |

**Items 3–15 are NOT DONE.** That is what v0.7.0 must add.

## Goals for v0.7.0

1. Ship a minimal, in-process OAuth 2.1 authorization server that:
   - Serves RFC 8414 metadata at `/.well-known/oauth-authorization-server`.
   - Serves JWKS at `/oauth/jwks.json`.
   - Implements the authorization-code + PKCE (S256) flow.
   - Supports CIMD (`client_id_metadata_document_supported: true`) and DCR
     (RFC 7591) as a fallback.
   - Echoes the `resource` parameter into the issued token's `aud` claim.
   - Mints RS256 JWTs with `iss`, `aud`, `exp`, `iat`, `nbf`, `scope`, `jti`.
2. Replace the static `MCP_AUTH_TOKEN` allowlist in `src/server/auth.ts` with
   real JWT validation. The static allowlist stays as a **fallback** for
   `MCP_AUTH_MODE=demo` (the local-demo experience users had before).
3. Add per-tool `securitySchemes` to every `registerAppTool` call. Default
   scheme is `noauth` (lab is read-only and currently runs in demo mode); an
   env var `MCP_OAUTH_REQUIRE_AUTH=true` flips the default to `oauth2` with
   appropriate scopes.
4. Add a `wrapTool()` helper that, when the active `securitySchemes` is
   `oauth2`, returns a tool result with `_meta["mcp/www_authenticate"]` set
   to a `Bearer` challenge when no/insufficient token is present.
5. Keep all 118 existing tests passing; add ~40-60 new tests.

## Non-goals (explicit)

These will NOT be in v0.7.0; they remain honest open risks after this work.

- **mTLS verification** of OpenAI's client certificate. This is a reverse-proxy
  job (nginx / cloudflared) and not part of the AS design. Documented in
  `docs/SECURITY.md`.
- **Production IdP integration** (Auth0, Okta, Cognito, Stytch). The in-process
  AS is a *demo-grade* server. Production deploys must replace it with one of
  those IdPs. The lab will document the cutover path in
  `docs/CHATGPT_APP_SETUP.md`.
- **Token revocation, refresh tokens, token rotation.** The lab's tokens are
  short-lived (15 min) and there is no refresh path. Re-authorization is the
  only path. OpenAI explicitly says reauthorization works without a refresh
  token; this is fine for demo.
- **Per-client rate limiting.** Out of scope; belongs in a reverse proxy.
- **CIMD for arbitrary HTTPS clients.** The lab's CIMD support accepts any
  client_id that is a valid `https://` URL and whose metadata document passes
  schema validation. We do NOT pre-allowlist ChatGPT's known client metadata
  URLs (those rotate per OpenAI's infra); we accept any URL and rely on the
  `redirect_uri` allowlist below for safety.

## Architecture

### New files

| Path | Purpose |
| --- | --- |
| `src/server/oauth/authorization-server-metadata.ts` | RFC 8414 metadata doc builder + well-known URL helpers |
| `src/server/oauth/jwks.ts` | RS256 key pair generation (in-memory, ephemeral), JWKS publication, sign/verify helpers |
| `src/server/oauth/pkce.ts` | PKCE S256 `code_verifier` → `code_challenge`; verifier validation |
| `src/server/oauth/cimd.ts` | Client ID Metadata Document resolution + validation; per-request client registry (cached) |
| `src/server/oauth/dcr.ts` | Dynamic Client Registration (RFC 7591) — minimal subset |
| `src/server/oauth/authorization-code-store.ts` | Short-lived (≤60s) in-memory store mapping `code → { clientId, redirectUri, scope, codeChallenge, codeChallengeMethod, resource, expiresAt }` |
| `src/server/oauth/token-issuer.ts` | Mints RS256 JWT with the right claims; binds `aud` to `resource` |
| `src/server/oauth/jwt-validator.ts` | Verifies JWT signature, `iss`, `aud`, `exp`, `nbf`, `scope`; returns the parsed claims or throws typed error |
| `src/server/oauth/consent-page.ts` | Tiny HTML consent UI stub served at `/oauth2/v1/authorize`; lab is read-only so consent is "always yes" with a clear log line |
| `src/server/oauth/security-schemes.ts` | Defines the per-tool scheme table: which tools are `noauth` and which are `oauth2:<scope>`; loaded from env or a static config |
| `tests/unit/oauth/pkce.test.ts` | S256 verifier correctness |
| `tests/unit/oauth/jwks.test.ts` | Key gen + sign + verify roundtrip |
| `tests/unit/oauth/cimd.test.ts` | Metadata document fetch + validate |
| `tests/unit/oauth/dcr.test.ts` | RFC 7591 minimal subset |
| `tests/unit/oauth/jwt-validator.test.ts` | Signature, exp, aud, iss, scope check |
| `tests/unit/oauth/security-schemes.test.ts` | Per-tool scheme lookup |
| `tests/integration/oauth/authorization-code.test.ts` | Full auth-code + PKCE flow against the lab's own AS |
| `tests/integration/oauth/cimd-flow.test.ts` | Full CIMD flow (CIMD metadata is self-hosted at `https://localhost/oauth/test-client.json`) |
| `tests/integration/oauth/dcr-flow.test.ts` | Full DCR flow (register → auth-code → token) |
| `tests/integration/oauth/jwt-protected-resource.test.ts` | End-to-end: obtain token, call a protected tool, expect 200; call with bad token, expect 401 + `_meta["mcp/www_authenticate"]` |
| `scripts/oauth-demo.ts` | Interactive demo: prints the well-known URL, opens a console-based auth-code + PKCE flow, then calls a protected tool with the resulting token |
| `docs/OAUTH_AS.md` | Setup + use + how to replace with Auth0/Okta in production |

### Modified files

| Path | Change |
| --- | --- |
| `src/server/app.ts` | Add new routes: `/.well-known/oauth-authorization-server`, `/.well-known/openid-configuration` (alias), `/oauth/jwks.json`, `/oauth2/v1/authorize`, `/oauth2/v1/token`, `/oauth2/v1/register`. Wire `requireBearerAuth` to the new `jwt-validator`. Keep the static `MCP_AUTH_TOKEN` fallback under `MCP_AUTH_MODE=demo`. |
| `src/server/auth.ts` | Replace `requireBearerAuth` with `requireAuth` that tries JWT first, falls back to `MCP_AUTH_TOKEN` only when `MCP_AUTH_MODE=demo`. Always emits the 401 challenge with `resource_metadata` (preserved). On 200, attaches the resolved claims to `req.auth` for tool handlers. |
| `src/server/tools/index.ts` | Add per-tool `securitySchemes` to each `registerAppTool` call. Tools are `noauth` by default; flip to `oauth2` with the appropriate scope via env config. |
| `src/server/tools/tool-types.ts` | `wrapTool()` now returns a `success()` shape with `_meta["mcp/www_authenticate"]` when the tool's scheme is `oauth2` and the caller has no/insufficient scope. |
| `src/server/oauth/protected-resource-metadata.ts` | The PRM doc now points at the lab's own AS (`http://${host}:${port}`) by default, and lists `client_id_metadata_document_supported: true` (MCP/OpenAI want this). |
| `package.json` | `+"oauth:demo"` script. Version `0.6.0` → `0.7.0`. |
| `docs/SECURITY.md` | Update the auth model: AS foundation now live; static allowlist is a fallback. |
| `docs/CHATGPT_APP_SETUP.md` | New "OAuth 2.1 AS" section with a copy-pasteable Auth0 cutover recipe. |
| `docs/research/OFFICIAL_DOCS_RESEARCH.md` | Add 4 new rows: RFC 8414, RFC 7591, RFC 8707, OAuth CIMD draft. |
| `docs/CHATGPT_APP_STORE.md` | Update the submission runbook: OAuth foundation now passes the App Review checklist. |

### Token format

```json
{
  "header": { "alg": "RS256", "typ": "JWT", "kid": "<jwks kid>" },
  "payload": {
    "iss": "http://127.0.0.1:8787",
    "sub": "demo-user",
    "aud": "http://127.0.0.1:8787/mcp",
    "iat": 1749312000,
    "nbf": 1749312000,
    "exp": 1749312900,
    "scope": "mcp:read",
    "client_id": "https://chatgpt.com/oauth/test/client.json",
    "jti": "uuid-v4"
  }
}
```

The `aud` claim is the PRM's `resource` value (RFC 8707). The validator rejects
any token whose `aud` doesn't match `MCP_OAUTH_RESOURCE`.

### Endpoints

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/.well-known/oauth-authorization-server` | GET | RFC 8414 metadata |
| `/.well-known/openid-configuration` | GET | OIDC discovery alias (same content) |
| `/oauth/jwks.json` | GET | JWKS (RS256 public key) |
| `/oauth2/v1/authorize` | GET | Authorization-code endpoint (PKCE S256) |
| `/oauth2/v1/token` | POST | Token exchange |
| `/oauth2/v1/register` | POST | Dynamic Client Registration (RFC 7591) |

All endpoints under `/oauth2/` use the same CORS allowlist as the rest of the
lab; the well-known endpoints are CORS `*` (public by design).

### Configuration (env)

| Var | Default | Meaning |
| --- | --- | --- |
| `MCP_AUTH_MODE` | `demo` | `demo` (static token fallback) or `oauth2` (real AS) |
| `MCP_OAUTH_ISSUER` | `http://${MCP_HOST}:${MCP_PORT}` | `iss` claim + AS metadata `issuer` |
| `MCP_OAUTH_TOKEN_TTL_SECONDS` | `900` | 15 min |
| `MCP_OAUTH_REQUIRE_AUTH` | `false` | when `true`, all `mcp:read` tools become `oauth2`-only |
| `MCP_OAUTH_ALLOW_INSECURE_HTTP` | `false` | when `true`, AS metadata is served over plain HTTP (lab only) |
| `MCP_OAUTH_CIMD_ALLOWLIST` | empty | comma-separated list of `client_id` URL hostnames to accept (empty = accept any HTTPS URL with valid metadata) |

## Test plan (target: ~50 new tests)

1. **Unit (PKCE):** 8 cases (verifier → challenge, S256, malformed verifier, length checks).
2. **Unit (JWKS):** 6 cases (key gen determinism, kid uniqueness, sign → verify roundtrip, signature tampering detected, wrong kid rejected, exp/nbf honoured).
3. **Unit (CIMD):** 10 cases (metadata fetch, schema validation, redirect_uri mismatch, scope mismatch, client registration cache, TLS requirement, expired metadata).
4. **Unit (DCR):** 6 cases (RFC 7591 minimal schema, initial_access_token enforcement when set, client_uri validation).
5. **Unit (JWT validator):** 8 cases (good token, expired, nbf in future, wrong aud, wrong iss, wrong scope, signature invalid, missing claim).
6. **Unit (security schemes):** 6 cases (default `noauth`, env override, scope look-up, unknown tool).
7. **Integration (auth-code):** 8 cases (no PKCE → 400, bad S256 → 400, wrong redirect_uri → 400, expired code → 400, happy path returns code, code is single-use, scope echoed, resource echoed into `aud`).
8. **Integration (CIMD):** 6 cases (CIMD metadata is fetched, token issued, `client_id` is the URL).
9. **Integration (DCR):** 4 cases (register → use new client_id → token issued).
10. **Integration (JWT-protected resource):** 8 cases (no token → 401 + challenge, bad token → 401, expired token → 401, good token + right scope → 200 + tool result, good token + wrong scope → 403 + `insufficient_scope` + `_meta["mcp/www_authenticate"]`).

## Migration path

`npm run verify` is currently 7/7. After v0.7.0 lands, the same 7 steps still
pass (`MCP_AUTH_MODE=demo` keeps the static-token path working). The new
`oauth:demo` script exercises the full AS flow against the lab's own AS for
in-CI proof.

The plan doc's "Out of scope" rule is preserved: no Anotator8 source edits.

## Risks

- **Self-signed tokens** are not a real production path. The lab is explicit
  about this in `docs/SECURITY.md`. Production deploys must swap the
  in-process AS for Auth0/Okta/Cognito/Stytch and re-point
  `MCP_OAUTH_AUTHORIZATION_SERVERS` at the IdP's issuer URL.
- **In-memory state** (auth-code store, client registry, JWKS key) is lost on
  restart. For demos this is fine; for production the AS is not used at all.
- **No refresh tokens** means every 15 min the user re-consents. Acceptable
  for read-only tools, not for write tools (which the lab doesn't have).
- **The lab's PKCE S256 implementation** must be byte-exact; we will use the
  `crypto` module's `createHash("sha256")` per RFC 7636 §4.2 and cross-check
  against the IETF-published test vectors in `tests/unit/oauth/pkce.test.ts`.

## Implementation order (within v0.7.0)

1. AS metadata module + well-known route (smallest, easiest to test).
2. PKCE S256 verifier (test vectors first; implementation second).
3. JWKS key gen + sign/verify (in-memory, ephemeral).
4. Authorization-code store + consent page stub.
5. `/oauth2/v1/authorize` endpoint (with PKCE S256 enforcement).
6. `/oauth2/v1/token` endpoint (authorization_code grant + PKCE verifier check + `resource` echo + JWT issuance).
7. `/oauth2/v1/register` endpoint (DCR).
8. CIMD resolver (HTTPS fetch + schema validation + redirect_uri allowlist).
9. `jwt-validator.ts` + new `auth.ts` `requireAuth` (JWT first, demo fallback second).
10. `security-schemes.ts` + per-tool wiring in `tools/index.ts`.
11. `wrapTool()` extension to emit `_meta["mcp/www_authenticate"]` on failure.
12. `scripts/oauth-demo.ts` (interactive proof).
13. Docs: `OAUTH_AS.md`, `SECURITY.md` update, `CHATGPT_APP_SETUP.md` update, `OFFICIAL_DOCS_RESEARCH.md` rows.
14. `npm run verify` reaches 8/8 (`+oauth:demo`).
15. PR to `main`.

## Decision points (need user input)

1. **Token storage** — in-memory only (simple, lost on restart) vs. a small
   SQLite/JSON file on disk (survives restart, slightly more code). Default:
   in-memory.
2. **Consent UI** — the lab is read-only, so consent is "always yes" with a
   clear log line. Real consent UX is out of scope; document the choice.
3. **CIMD scope** — accept any HTTPS `client_id` URL whose metadata passes
   schema validation, vs. require `MCP_OAUTH_CIMD_ALLOWLIST` to be set
   (production-safer). Default: accept-any (lab is local-only).

## Open questions for the maintainer

1. Do you want a real Auth0/Okta cutover recipe in this PR, or in a follow-up?
2. Is `MCP_AUTH_MODE=oauth2` (real AS) the new default, or should `demo`
   remain the default and require an explicit opt-in? Recommendation:
   keep `demo` as the default to preserve backwards compatibility with
   `npm run dev` / Claude Desktop / Cursor users, and require an explicit
   `MCP_AUTH_MODE=oauth2` for production.
3. Should the lab's OAuth AS support a tiny "user database" (one demo user)
   for the consent page, or should it issue tokens without identifying a
   user (anonymous demo, `sub: "demo-user"`)? Recommendation: anonymous
   demo, since the lab is read-only and the user is "the person running
   npm run dev".

---

**Approve this design and I'll implement it. Reject and I'll work on a
different honest risk.**
