# Role 03 — Protocol / Transport / Middleware

> **role_id:** 03-protocol-transport-middleware
> **purpose:** Спроецировать «OS / Kernel / HAL / Middleware» на MCP 2025-06-18 / Apps SDK 2026-01-26 / RFC 9728 / RFC 6750. Показать protocol stack, CORS, auth shape, middleware.
> **canonical_inputs:** `canonical/official-doc-record.yaml`, `canonical/decision-record/auth-strategy.yaml`, `canonical/decision-record/bridge-strategy.yaml`
> **canonical_outputs:** Этот Markdown — generated view.
> **generated_from:** `canonical/official-doc-record.yaml` (12 official docs) + `src/server/app.ts` + `src/server/index.ts` + `src/server/oauth/`
> **last_generated:** 2026-06-07
> **coverage_score:** 0.9 (MCP 2025-06-18, Apps 2026-01-26, RFC 9728, RFC 6750 all named; OAuth 2.1 AS deferred)
> **what_this_role_can_prove:** Какой протокол/транспорт объявлен; какой CORS-allowlist; какой auth shape
> **what_this_role_cannot_prove:** Что ChatGPT на самом деле делает на своей стороне; что Apps SDK reviewer примет PRM foundation
> **related_truth_passports:** `truth-passport/lab-v0.4.0.yaml`, `truth-passport/decision-auth-strategy.yaml`, `truth-passport/decision-bridge-strategy.yaml`
> **related_decisions:** `decision-auth-strategy`, `decision-bridge-strategy`
> **related_gaps:** G-01 (OAuth 2.1 AS), G-02 (ChatGPT e2e), G-07 (per-tool scope)
> **related_discovery_leads:** `mcp-sdk-1.30`, `apps-sdk-post-2026-01-26`, `oauth-2.1-as-ref-impl`
> **safe_next_actions:** OAuth 2.1 AS implementation, live e2e verification
> **forbidden_shortcuts:** "production auth" без AS
> **expansion_opportunities:** Sampling / roots endpoints (deferred)

## Stack (boot chain)

```text
MCP 2025-06-18
├── initialize (protocolVersion handshake)
├── tools/list (8 read-only tools)
├── tools/call (per-tool with Zod I/O)
├── resources/list (1 widget)
├── resources/read (ui://anotator8/review-widget.html)
├── prompts/list (1 prompt)
└── prompts/get (review_anotator8_project)
   ↓
Apps SDK 2026-01-26 (upper layer, ChatGPT only)
├── _meta.ui.resourceUri on every tool
└── widget bridge
    ├── Primary: postMessage JSON-RPC (ui/initialize + tools/call)
    └── Fallback: window.openai.callTool
   ↓
Auth (RFC 6750 Bearer + RFC 9728 PRM foundation)
├── Authorization: Bearer <token>
├── WWW-Authenticate: Bearer realm=..., error=..., resource_metadata=...
└── /.well-known/oauth-protected-resource[/<path>]
   ↓
Transport
├── Streamable HTTP (default, 127.0.0.1:8787/mcp)
│   ├── Accept: application/json, text/event-stream
│   ├── Mcp-Session-Id (per-request randomUUID)
│   └── CORS allowlist: https://chatgpt.com, https://chat.openai.com (+CORS_ORIGIN)
└── stdio (opt-in via MCP_TRANSPORT=stdio, local MCP clients)
```

## Apps SDK host bridge (ChatGPT specific)

| Path | Mechanism | Status |
|---|---|---|
| Primary | postMessage JSON-RPC, `protocolVersion: "2026-01-26"`, `ui/initialize` + `tools/call` | IMPLEMENTED + CONTRACT TEST |
| Fallback | `window.openai.callTool` (Apps SDK 1.x) | IMPLEMENTED + CONTRACT TEST |
| Detection | `bridge-info` span in widget | RUNTIME (widget shows active) |
| Hidden when no bridge | focus-panel.hidden = !hasUsableBridge() | RUNTIME (no fake UI) |

## CORS posture

| Origin | Status |
|---|---|
| `https://chatgpt.com` | DEFAULT ALLOW |
| `https://chat.openai.com` | DEFAULT ALLOW |
| localhost (no origin) | ALLOW (for MCP Inspector + smoke) |
| `CORS_ORIGIN` (comma-separated) | OPTIONAL EXTENSION |
| `*` (wildcard) | NOT DEFAULT (CORS only echoes req.headers.origin) |

## Auth shape (RFC 6750 + RFC 9728)

```http
POST /mcp HTTP/1.1
Authorization: Bearer <MCP_AUTH_TOKEN>
Content-Type: application/json
Mcp-Session-Id: <uuid>

{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}
```

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="anotator8-chatgpt-lab",
                  error="invalid_request",
                  resource_metadata="http://127.0.0.1:8787/.well-known/oauth-protected-resource/mcp"
```

## DEMO-ONLY posture (when MCP_AUTH_TOKEN unset)

```text
================================================================
 WARNING: MCP_AUTH_TOKEN is unset.
 This mode is intended ONLY for local development (localhost).
 Any reachable network client can call all 8 read-only tools.
 BEFORE exposing on a public tunnel: set MCP_AUTH_TOKEN=<random>.
 See docs/SECURITY.md and docs/CHATGPT_APP_SETUP.md.
================================================================
```

## App can do × system rights needed × OEM only × unsafe × compatibility traps

| Action | System rights | OEM only? | Unsafe? | Compatibility trap |
|---|---|---|---|---|
| `tools/list` | none (HTTP layer) | no | no | None |
| `tools/call` (8 read-only) | none | no | no | Input must be Zod-valid projectData or fixtureId |
| `resources/read` (widget) | none | no | no | CSP locked |
| `prompts/get` | none | no | no | None |
| `/.well-known/oauth-protected-resource` | none (public) | no | no | Returns only public metadata |
| `/_meta.projectData` (widget hidden) | session | no | privacy | LLM can read structuredContent |
| postMessage to window.parent | none (widget) | no | medium | UU-07: no origin filter |
| shell exec | n/a | n/a | n/a | ZERO in src/server/** (invariant) |
| FS write | n/a | n/a | n/a | ZERO in src/server/** (invariant) |
| Anotator8 backend access | none (lab is external) | would need porting | high | not implemented; see PORTING_TO_ANOTATOR8.md |

## OAuth 2.1 AS — DEFERRED

The lab ships:
- ✅ RFC 9728 PRM foundation (metadata document at well-known URL)
- ✅ RFC 6750 Bearer (with optional MCP_AUTH_TOKEN)
- ❌ OAuth 2.1 AS endpoints (token issuance, introspection, JWKS, DCR, scopes)

For App Store public submission, AS is required. See `canonical/discovery-lead/oauth-2.1-as-ref-impl.yaml`.

## Compatibility traps

1. **Apps SDK 2026-01-26 vs Apps SDK 1.x**: lab uses bridge as primary, legacy as fallback. If ChatGPT drops legacy, lab still works. If ChatGPT drops new bridge, lab falls back.
2. **MCP 2025-06-18 session ID**: lab uses `randomUUID()` per session. If client doesn't send `Mcp-Session-Id`, server creates a new session.
3. **CORS preflight**: lab handles OPTIONS. ChatGPT connector wizard does preflight first.
4. **stdio + MCP_AUTH_TOKEN**: token is ignored in stdio mode (no HTTP request). Local trust = OS process boundary.
5. **Streamable HTTP response format**: lab writes JSON-RPC responses. For SSE, lab does not currently emit; only JSON. (Accept header is "application/json, text/event-stream" but lab uses JSON only.)
6. **Apps SDK `as never` cast**: in `src/server/app.ts:73-74, 83`, `inputSchema` and `outputSchema` are cast to `never` to work around SDK 1.29.0 callback signature. Will need removal when SDK types are fixed.
7. **ext-apps 1.7.4 recursion bug**: non-fatal; captured to audit log via `unhandledRejection` handler. Tests pass cleanly.
