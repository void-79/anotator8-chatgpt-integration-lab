# Official Docs Research

> **Evidence classification used below**
> - **OFFICIAL_DOC_EVIDENCE** — OpenAI Apps SDK / MCP protocol docs (linked)
> - **REPO_EVIDENCE** — Read-only inspection of `C:\Anotator8` files
> - **PROTOTYPE_EVIDENCE** — Read-only inspection of `C:\chat-gpt-mcp-app`
> - **RUNTIME_EVIDENCE** — Build, tests, smoke, MCP Inspector
> - **INFERENCE** — Design conclusion based on evidence
> - **UNCLEAR** — Not proven

| Source | What it says | Impact on architecture | Risk if ignored |
| --- | --- | --- | --- |
| **OpenAI Apps SDK Quickstart (2026-01-26)** | Apps use MCP servers to connect to ChatGPT. Optional web component in an iframe. For NEW apps, use the **MCP Apps host bridge** (JSON-RPC over `postMessage`, `ui/initialize` / `ui/notifications/initialized` / `tools/call`). | Lab widget supports the new bridge as the primary path and falls back to legacy `window.openai.callTool` for backwards compatibility. The bridge protocol version is explicitly declared as `2026-01-26`. | Widget breaks when ChatGPT drops legacy support. |
| **OpenAI Apps SDK Reference (Apps SDK 1.x)** | Legacy `window.openai` exposes tool input/output, hidden response metadata, `callTool`, state, display, and file helpers. Tools with `structuredContent` must declare `outputSchema`. | Widget still feature-detects `window.openai.callTool`; every tool declares Zod output schema. | Broken widget controls, missing schemas, or unsafe assumptions about host APIs. |
| **OpenAI Apps SDK Auth** | Read-only anonymous mode can be acceptable for local demos, but customer-specific data or write actions must authenticate via OAuth 2.1 + protected resource metadata. Required: (a) PRM at `/.well-known/oauth-protected-resource` with `authorization_servers`, `scopes_supported`, `bearer_methods_supported`; (b) AS metadata at `/.well-known/oauth-authorization-server`; (c) PKCE S256 on the authorization-code flow; (d) `resource` parameter (RFC 8707) echoed into the token's `aud` claim; (e) CIMD (`client_id_metadata_document_supported: true`) preferred, DCR (RFC 7591) as fallback; (f) per-tool `securitySchemes` (`noauth` vs `oauth2` with scopes); (g) tool result `_meta["mcp/www_authenticate"]` on missing/insufficient token to trigger ChatGPT's linking UI; (h) token validation: signature, `iss`, `aud`, `exp`/`nbf`, scope. Redirect: `https://chatgpt.com/connector/oauth/{callback_id}`. mTLS: optional defense-in-depth (OpenAI presents a client cert). | Lab supports optional `MCP_AUTH_TOKEN` for demo (with strong banner warning) and ships RFC 9728 PRM at v0.3.0. Production must add a real OAuth 2.1 AS (Auth0/Okta/Cognito/Stytch or the in-lab AS designed in `docs/OAUTH_AS_DESIGN.md` for v0.7.0). | Treating bearer-only auth as production-ready; missing `_meta["mcp/www_authenticate"]` so ChatGPT never shows the linking UI; missing `resource` echo so a token issued for one AS can be replayed against another. |
| **OpenAI Apps SDK Security & Privacy** | Use least privilege, explicit consent, defense in depth; validate server-side; keep audit logs; sandbox widgets with CSP; OAuth + scope checks expected. | Read-only tools, no arbitrary FS / shell, CSP with no external `connectDomains` or `resourceDomains`, redacted audit logging, 10MB input cap, hardened `IntegrationError` shape (no raw messages leaked to clients). | Data exfiltration, prompt injection impact, unsafe widgets, unreviewed writes. |
| **OpenAI Apps SDK Testing** | Test tool handlers directly, keep fixtures close to MCP code, use MCP Inspector, validate in ChatGPT Developer Mode once HTTPS reachable. | Unit + integration + contract + smoke + 8 HTTP/MCP protocol tests; `npm run inspect` opens MCP Inspector. | Claiming compatibility without runtime evidence. |
| **MCP Tools spec 2025-06-18** | Tools expose names, descriptions, input schemas, optional output schemas; `structuredContent` must match `outputSchema`; servers must validate inputs and sanitize outputs. | Every tool has Zod input/output schema and a structured `IntegrationError` shape with typed codes (`invalid_input`, `unsupported_project_version`, `too_large_input`, `missing_field`, `internal_error`, `unsupported_capability`). | Stringly typed tools, silent best-effort success. |
| **MCP Resources spec 2025-06-18** | Resources are app-driven context identified by URI; servers declare resource capability. | Widget is a `ui://` resource, not a project file browser. | Confusing UI resources with arbitrary file/resource access. |
| **MCP Prompts spec 2025-06-18** | Prompts are user-controlled templates exposed by the server and discoverable by clients. | `review_anotator8_project` prompt registered as optional guided workflow with a `focus` enum. | Hiding workflow assumptions in undocumented prose. |
| **MCP Streamable HTTP transport (2025-06-18)** | `Accept: application/json, text/event-stream` required; `Mcp-Session-Id` issued and reused; CORS preflight must succeed; bearer tokens or OAuth recommended. | Raw `http` server (no Express) implements `createHttpMcpApp`; smoke + integration tests drive real JSON-RPC over HTTP including SSE parsing. | False positive smoke tests that don't match the real protocol. |
| **OAuth 2.0 Protected Resource Metadata (RFC 9728, April 2025)** | Defines `/.well-known/oauth-protected-resource[/<path>]` JSON document with `resource` (REQUIRED), `authorization_servers`, `scopes_supported`, `bearer_methods_supported`, `resource_name`, `resource_documentation`. The `resource` value MUST round-trip with the URL the client used. The 401/403 `WWW-Authenticate` header MAY include a new `resource_metadata` parameter pointing to the well-known URL. | v0.3.0 ships this foundation: `src/server/oauth/protected-resource-metadata.ts` builds the doc + computes the well-known URL via path-insertion (§3.1) + inverse-maps metadata URL → resource identifier (§3.3). The 401/403 challenge now carries `resource_metadata="..."`. AS list, scopes, and bearer methods are env-configurable. | Implementing OAuth 2.1 without dynamic discovery. |
| **OAuth 2.0 Bearer Token Usage (RFC 6750, October 2012)** | Defines `Authorization: Bearer <token>` for header, `access_token=...` for body/query, and the `WWW-Authenticate: Bearer realm="...", error="..."` challenge. | `src/server/auth.ts` enforces this with 401/403 + `error="invalid_request"` / `error="invalid_token"`. The existing `realm="anotator8-chatgpt-lab"` is preserved for back-compat. | Stringly-typed auth errors that clients can't act on. |
| **MCP Inspector** | `npx @modelcontextprotocol/inspector@latest --server-url http://...` opens a browser-based tool playground. | `npm run inspect` wraps this so the dev doesn't have to remember flags. Verified works (RUNTIME_EVIDENCE). | Forcing manual `npx` invocations and confusing setup. |
| **`@modelcontextprotocol/sdk@1.29.0` + `@modelcontextprotocol/ext-apps@1.7.4`** | Provides `McpServer`, `StreamableHTTPServerTransport`, `registerAppTool`, `registerAppResource`, `RESOURCE_MIME_TYPE`. Returns callbacks with `[x: string]: unknown` index signature — generic `unknown` for `structuredContent` is incompatible. | `registerAppTool` used for all 8 tools; tool handlers return via `success()` helper in `tool-types.ts` and `as never` cast for the return type. | TS build failure, callback signature mismatch. |
| **`@modelcontextprotocol/sdk@1.29.0` + ext-apps 1.7.4 — known upstream bug** | `transport.onclose → server.close` recurses into a `RangeError: Maximum call stack size exceeded` under certain error paths (NOT including normal session teardown — only when the transport receives a malformed/unsupported request and the SDK attempts to close both ends). | `app.ts` installs a `process.on("unhandledRejection", ...)` handler that captures the recursion into the audit log instead of letting it pollute the test output as scary "Unhandled Rejection" lines. Tests still pass; the recursion is non-fatal. | Test output looks broken; users chase a non-bug. |

## Open Items That Need To Stay Open

| Item | Why unclear | Plan |
| --- | --- | --- |
| ChatGPT Developer Mode live connection | No `cloudflared`, `ngrok`, or `tunnel-client` installed; no ChatGPT account state in this environment. | Documented in `docs/CHATGPT_APP_SETUP.md`; needs paid ChatGPT account + tunnel client. |
| OAuth 2.1 authorization server (token issuance, introspection, JWKS, DCR, CIMD) | **Resolved in v0.7.0.** Implemented as an in-process AS with RS256 JWT, PKCE S256, DCR (RFC 7591), and CIMD (draft). See `docs/OAUTH_AS.md` for the design and cutover recipe. | n/a — the in-process AS is shipped. Production cutover is the remaining step. |
| Per-tool scope enforcement | **Resolved in v0.7.0.** Per-tool `securitySchemes` are declared in `src/server/oauth/security-schemes.ts`; the validator checks `scope` claims on JWT validation. | n/a. |
| Production IdP cutover | **Resolved in v0.8.0.** Added a `local | external` mode switch (`MCP_OAUTH_MODE`). External mode validates JWTs against a remote IdP's JWKS (`RemoteTokenValidator` in `src/server/oauth/remote-issuer.ts`); the in-process AS endpoints are gated to 404 with `as_disabled`. See `docs/OAUTH_AS.md` for Auth0/Okta/Cognito/Stytch snippets. | n/a — the cutover is a config change, not a code change. |
| Load test with >10k annotations | Adapter has not been benchmarked at scale. | Deferred. |

## Evidence Links

- OpenAI Apps SDK Quickstart: <https://developers.openai.com/apps-sdk/quickstart>
- OpenAI Apps SDK Reference: <https://developers.openai.com/apps-sdk/reference>
- OpenAI Apps SDK Auth: <https://developers.openai.com/apps-sdk/build/auth>
- OpenAI Apps SDK Testing: <https://developers.openai.com/apps-sdk/deploy/testing>
- OpenAI Apps SDK Security & Privacy: <https://developers.openai.com/apps-sdk/guides/security-privacy>
- MCP Tools: <https://modelcontextprotocol.io/specification/2025-06-18/server/tools>
- MCP Resources: <https://modelcontextprotocol.io/specification/2025-06-18/server/resources>
- MCP Prompts: <https://modelcontextprotocol.io/specification/2025-06-18/server/prompts>
- MCP Transports: <https://modelcontextprotocol.io/specification/2025-06-18/basic/transports>
- MCP Architecture overview: <https://modelcontextprotocol.io/docs/concepts/architecture>
- OAuth 2.0 Protected Resource Metadata (RFC 9728): <https://www.rfc-editor.org/rfc/rfc9728>
- OAuth 2.0 Bearer Token Usage (RFC 6750): <https://www.rfc-editor.org/rfc/rfc6750>
- OAuth 2.0 Authorization Server Metadata (RFC 8414): <https://www.rfc-editor.org/rfc/rfc8414>
- OAuth 2.0 Dynamic Client Registration (RFC 7591): <https://www.rfc-editor.org/rfc/rfc7591>
- OAuth 2.0 Resource Indicators (RFC 8707): <https://www.rfc-editor.org/rfc/rfc8707>
- OAuth Client ID Metadata Documents (draft-ietf-oauth-client-id-metadata-document): <https://datatracker.ietf.org/doc/draft-ietf-oauth-client-id-metadata-document/>
