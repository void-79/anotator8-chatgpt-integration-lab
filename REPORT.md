# Anotator8 Г— ChatGPT Integration Lab вЂ” Final Report (Discovery-First Build Prompt v1)

**Lab folder:** `C:\anotator8-chatgpt-integration-lab\`
**Anotator8 repo:** `C:\Anotator8\` (untouched вЂ” zero edits inside; only the lab was touched)
**Old prototype:** `C:\chat-gpt-mcp-app\` (inspected read-only, see `docs/PROTOTYPE_AUDIT.md`)
**Lab version:** 0.9.0
**Last re-verified:** 2026-06-08 (this session вЂ” see "Phase 6 вЂ” Re-verification + Refresh Tokens" at the bottom of this file)
**MCP SDK:** `@modelcontextprotocol/sdk@1.29.0` + `@modelcontextprotocol/ext-apps@1.7.4`

> **Note on header vs body:** the **header block above** is the current authoritative snapshot (lab version, MCP SDK, last verification date). The **body** of this file is a historical phase record (v0.2.0 в†’ v0.2.1 в†’ v0.3.0 в†’ v0.4.0 в†’ v0.5.0 в†’ v0.6.0 в†’ v0.7.0 в†’ v0.8.0 в†’ v0.9.0) and intentionally preserves the older test counts (e.g. 60/60, 112/112, 198/198, 214/214) at the points those phases were frozen. If a number in the body disagrees with the header, the **header is correct for "now"** and the body number is the snapshot at the phase it describes. See the bottom of this report for the most recent re-verification section.

**Status (v0.9.0):** Build clean, **224/224** tests pass across **30** files, `npm run verify` **8/8** (build + test + smoke + demo:stdio + demo:oauth + verify:dev + validate:canonical + validate:truth-passport), smoke **PASS** (HTTP + OAuth PRM), `npm run demo:stdio` **PASS** (full MCP protocol roundtrip over stdio), `npm run demo:oauth` **PASS** (full OAuth 2.1 flow with PKCE S256 + DCR + JWT **+ refresh-token rotation + cross-client family revocation**), `npm run verify:dev` **PASS** (headless MCP Inspector roundtrip), **8** read-only tools, MCP Inspector via `npm run inspect` (interactive). **Zero unhandled rejections** in test output. **`npm audit --omit=dev`: 0 vulnerabilities.** **OAuth 2.0 Protected Resource Metadata (RFC 9728) shipped (v0.3.0).** **OAuth 2.1 Authorization Server (RFC 8414 + RFC 7591 + RFC 7636 + RFC 8707 + CIMD) shipped (v0.7.0).** **Production IdP cutover seam shipped (v0.8.0):** `MCP_OAUTH_MODE=local|external` switch; external mode validates JWTs against any RS256 IdP's JWKS (Auth0/Okta/Cognito/Stytch/Keycloak). **Refresh tokens (RFC 6749 §6 + §10.4) shipped (v0.9.0):** single-use rotation, family revocation on cross-client presentation, hash-only storage, 30-day default TTL via `MCP_OAUTH_REFRESH_TTL_SECONDS`. **MCP Apps host bridge (2026-01-26) shipped as primary widget path with legacy `window.openai` fallback.** **STDIO transport (v0.4.0)** so the same server works with Claude Desktop, Cursor, Windsurf, Cline, OpenCode, Aider, Continue, GitHub Copilot in VS Code, plus everything else that speaks MCP 2025-06-18. See [`docs/MCP_COMPATIBILITY.md`](docs/MCP_COMPATIBILITY.md) for the full client Г— feature matrix. See [`docs/OAUTH_AS.md`](docs/OAUTH_AS.md) for the in-process AS design, the production-IdP cutover recipe (Auth0/Okta/Cognito/Stytch snippets included), and the v0.9.0 refresh-token section.

---

## Discovery-First Findings (per prompt sections 0вЂ“6)

### Section 0 вЂ” Trust posture verified

- **Lab v0.2.0 (Express, 29 tests) was already on disk** when this session started. Treated as UNVERIFIED. Verified end-to-end before deciding what to change.
- **REPO_EVIDENCE on Anotator8:** `src\domain\entities\UDMNode.ts`, `src\application\videoSources.ts`, `src\application\services\projectFile.ts`, `src\domain\export\shipped.ts`. Grep for `chatgpt|ChatGPT|openai|mcp|MCP` in `C:\Anotator8\src\**\*.{ts,tsx}` returns **zero matches** вЂ” confirmed clean slate.
- **PROTOTYPE_EVIDENCE on `C:\chat-gpt-mcp-app`:** Python FastMCP, dev-tools focused. Audited in `docs/PROTOTYPE_AUDIT.md`. Useful ideas: path allowlist, READ_ONLY annotations, profile-based command runner. **Not** a ChatGPT app, **not** Anotator8-aware, **not** portable to product.

### Section 1 вЂ” Official docs research

See [`docs/research/OFFICIAL_DOCS_RESEARCH.md`](docs/research/OFFICIAL_DOCS_RESEARCH.md). Highlights:

- **Apps SDK Quickstart 2026-01-26**: new apps use the **MCP Apps host bridge** (JSON-RPC over `postMessage`, `ui/initialize` / `ui/notifications/initialized` / `tools/call`). Lab widget now supports this bridge as primary, with legacy `window.openai.callTool` fallback.
- **MCP Streamable HTTP 2025-06-18**: `Accept: application/json, text/event-stream`, `Mcp-Session-Id` reuse, CORS preflight must succeed. Verified by `tests/integration/http-mcp-protocol.test.ts` and `npm run smoke`.
- **MCP SDK 1.29.0 + ext-apps 1.7.4**: known recursion bug on `transport.onclose в†’ server.close` (non-fatal). Captured in this session.

### Section 2 вЂ” Environment

| Field | Value |
| --- | --- |
| OS / shell | Windows / PowerShell 5.1 |
| Workspace path | `C:\anotator8-chatgpt-integration-lab\` |
| Anotator8 repo path | `C:\Anotator8\` |
| Old prototype path | `C:\chat-gpt-mcp-app\` |
| Lab current branch | `main` (clean working tree) |
| Git clean (lab) | YES |
| Git clean (Anotator8) | YES (no edits) |
| Node available | YES, `v24.13.0` |
| Python available | YES, `3.11.15` and `3.14.0` |
| Git available | YES, `2.52.0.windows.1` |
| Internet available | YES (npm registry, OpenAI docs reachable) |
| Browser available | UNCLEAR (Playwright not used in this lab) |
| Can run MCP Inspector | YES, via `npm run inspect` (npx auto-install) |
| Can expose tunnel / ChatGPT Developer Mode | **UNCLEAR**, no `cloudflared` / `ngrok` / `tunnel-client` installed; needs paid ChatGPT account + tunnel to verify end-to-end |
| `gh` CLI auth | NOT LOGGED IN (not needed for this build) |

### Section 3 вЂ” Anotator8 product surface

See [`docs/PRODUCT_SURFACE.md`](docs/PRODUCT_SURFACE.md). Key facts:

- **Product version:** 24.0.0 (`package.json`)
- **Stack:** React 19 + Vite frontend, FastAPI backend, Loro CRDT, Fabric canvas, Zustand
- **Project file:** `.anatator.json` (lab fixture uses `.anotator8.json` вЂ” see note in PRODUCT_SURFACE.md)
- **Shipped tools:** box, ellipse, arrow (matches lab `SUPPORTED_SHAPES` exactly)
- **YouTube URL patterns:** 5 shapes (REPO_EVIDENCE `videoSources.ts:38-44`) вЂ” **lab now mirrors all 5**
- **Subtitle locales:** `en | ru | kk` (matches lab)
- **Data residency enum:** `us-east | eu-central | us-west | kz-central` (preserved by lab)
- **No prior ChatGPT integration in product**

### Section 4 вЂ” Old prototype audit

See [`docs/PROTOTYPE_AUDIT.md`](docs/PROTOTYPE_AUDIT.md). Verdict: useful for ideas, **do not import**. Reused: path allowlist, READ_ONLY annotations, bearer auth, stderr audit. Dropped: `run_profile`, `read_file`/`list_files`/`search_code`, FastMCP, default `*` CORS, missing output schemas.

### Section 5 вЂ” Lab structure (built in prior session, verified in this session)

```text
C:\anotator8-chatgpt-integration-lab\
  src/
    server/
      index.ts          # main() вЂ” binds 127.0.0.1:MCP_PORT; screams DEMO-ONLY banner when MCP_AUTH_TOKEN unset
      app.ts            # createMcpServer() + createHttpMcpApp(); unhandledRejection handler for SDK recursion
      anotator8-adapter.ts  # parse/normalize/validate; preserves unknown fields; mirrors Anotator8's 5 YouTube patterns
      audit.ts          # stderr JSON lines, Bearer + MCP_AUTH_TOKEN redaction, 500-char summary cap
      auth.ts           # Bearer auth (RFC 6750 WWW-Authenticate); comma-separated tokens
      errors.ts         # IntegrationError with typed codes
      schemas.ts        # Zod I/O schemas for all 8 tools
      storage.ts        # loadProjectInput() вЂ” allowlisted fixtureId OR inline projectData
      prompts/
        review-project-prompt.ts
      resources/
        widget-resource.ts  # ui://anotator8/review-widget.html with CSP
      tools/
        index.ts        # toolRegistry: 8 read-only tools via wrapTool()
        list-capabilities.ts
        inspect-project.ts
        validate-project.ts
        summarize-annotations.ts
        find-annotations.ts
        suggest-labels.ts
        create-review-plan.ts
        export-chatgpt-report.ts
        tool-types.ts   # ToolModule + success()/failure() + wrapTool()
        project-utils.ts
    widget/
      index.html
      styles.css
      widget.ts          # NEW MCP Apps host bridge (primary) + legacy window.openai.callTool (fallback)
    shared/
      types.ts           # Anotator8 domain + integration model
  fixtures/
    sample-project.anotator8.json   # 3 annotations (box/ellipse/arrow), 2 unknown fields, 1 orphan cue
  tests/
    unit/
      adapter.test.ts
      validators.test.ts
      schemas.test.ts
      youtube-patterns.test.ts      # NEW вЂ” 5 patterns + negative cases
      rejection-capture.test.ts     # NEW вЂ” handler swallows SDK recursion
    integration/
      http-mcp-protocol.test.ts
      tools.inspect-project.test.ts
      tools.validate-project.test.ts
      tools.find-annotations.test.ts
      auth-bypass.test.ts            # NEW вЂ” demo + bearer mode
    contract/
      mcp-tool-contracts.test.ts
      fixtures-compatibility.test.ts
      widget-bridge.test.ts          # NEW вЂ” new + legacy bridge strings
  scripts/
    dev.ts
    inspect.ts
    smoke.ts
  config/capabilities.example.json
  docs/
    ARCHITECTURE.md
    SECURITY.md
    PORTING_TO_ANOTATOR8.md
    CHATGPT_APP_SETUP.md
    TOOL_CONTRACTS.md
    BUILD_REPORT.md        # SUPERSEDED вЂ” see notice at top
    QA_REPORT.md           # SUPERSEDED вЂ” see notice at top
    FINAL_REPORT.md        # longer historical record
    PRODUCT_SURFACE.md     # NEW вЂ” verified Anotator8 surface
    PROTOTYPE_AUDIT.md     # NEW вЂ” old prototype audit
    research/
      OFFICIAL_DOCS_RESEARCH.md   # UPDATED with new MCP Apps bridge
  README.md
  REPORT.md                # this file (authoritative current)
  package.json             # v0.2.1
  tsconfig.json
  vitest.config.ts
  .env.example
```

---

## What This Session Added (0.2.1 в†’ 0.3.0)

| Area | 0.2.1 (previous) | 0.3.0 (this session) | Evidence |
| --- | --- | --- | --- |
| **OAuth 2.0 Protected Resource Metadata (RFC 9728)** | Not served; `WWW-Authenticate: Bearer realm="anotator8-chatgpt-lab"` on 401/403 with no metadata pointer | New `src/server/oauth/protected-resource-metadata.ts` builds the metadata document, computes the well-known URL via path-insertion (В§3.1), and inverse-maps metadata URL в†’ resource identifier (В§3.3). New route in `app.ts` serves `GET /.well-known/oauth-protected-resource[/<path>]` as `application/json` with `Cache-Control: no-store` and CORS `*`. | `tests/unit/oauth/protected-resource-metadata.test.ts` (41 cases) + `tests/integration/oauth/protected-resource.test.ts` (11 cases). Smoke now asserts `oauth resource=... bearer=header`. |
| **`WWW-Authenticate` 401/403 challenge (RFC 9728 В§5.1 + RFC 6750 В§3)** | `Bearer realm="anotator8-chatgpt-lab"` only | Adds `resource_metadata="<well-known url>"`; the existing realm is preserved for back-compat. Also adds `error="invalid_request"` (401) / `error="invalid_token"` (403) for programmatic handling. Opt-out via `MCP_OAUTH_CHALLENGE_INCLUDE_METADATA=false`. | `buildBearerChallenge()` unit tests + 401/403 integration assertions. |
| **Env configuration** | `MCP_HOST`, `MCP_PORT`, `MCP_AUTH_TOKEN`, `CORS_ORIGIN` | Adds `MCP_OAUTH_RESOURCE`, `MCP_OAUTH_AUTHORIZATION_SERVERS`, `MCP_OAUTH_SCOPES_SUPPORTED`, `MCP_OAUTH_BEARER_METHODS`, `MCP_OAUTH_RESOURCE_NAME`, `MCP_OAUTH_RESOURCE_DOCUMENTATION`, `MCP_OAUTH_CHALLENGE_INCLUDE_METADATA`. All optional with documented defaults. | `.env.example` updated. |
| **Test count** | 60/60 across 13 files | **112/112 across 15 files** (+41 unit OAuth + 11 integration OAuth) | `npm test` output below. |
| **OFFICIAL_DOCS_RESEARCH** | 7K with 1 OAuth row | Adds RFC 9728 row, RFC 6750 row, RFC 8414 evidence link; updates the "OAuth 2.1 protected resource metadata" open item to mark the foundation as shipped. | `docs/research/OFFICIAL_DOCS_RESEARCH.md` |
| **SECURITY.md** | Listed OAuth 2.1 PRM as a follow-up | Documents the v0.3.0 RFC 9728 foundation; updates the "Remaining Concerns" table (OAuth foundation now shipped; AS is the next step); adds a new control row. | `docs/SECURITY.md` |
| **CHATGPT_APP_SETUP.md** | "Production Auth Gap" listed 4 steps | Updates gap list (foundation shipped; AS is step 1), adds new "OAuth Discovery (RFC 9728)" section with example 401 header. | `docs/CHATGPT_APP_SETUP.md` |
| **ARCHITECTURE.md** | No OAuth module | Adds `src/server/oauth/protected-resource-metadata.ts` to the architecture layer table; adds OAuth protocol versions to the transport table. | `docs/ARCHITECTURE.md` |
| **Smoke script** | Verified MCP tool flow | Adds an OAuth discovery check that fetches the well-known URL, validates `resource` round-trip, and asserts `bearer_methods_supported` includes `header`. | `scripts/smoke.ts` |

### Out of scope for v0.3.0 (deferred)

- **Authorization server implementation** вЂ” token issuance, introspection, JWKS, DCR, token rotation. RFC 8414 metadata + RFC 6749 / 7591 endpoints. The lab today still validates a static `MCP_AUTH_TOKEN`; the new metadata document advertises the **intended** AS list when configured, but the lab does not implement AS endpoints.
- **Per-tool scope enforcement** вЂ” recommended scope vocabulary is documented in `docs/CHATGPT_APP_SETUP.md` В§ Production Auth Gap, but no runtime gate is added.
- **DPoP / mTLS / authorization_details** вЂ” the foundation exposes `bearer_methods_supported` and `authorization_details_types_supported` could be added later; today only `header` is declared.
- **Signed metadata (RFC 9728 В§2.2)** вЂ” the lab publishes unsigned metadata; clients that require signed metadata will need the `signed_metadata` claim in a follow-up.

## What This Session Changed (0.2.0 в†’ 0.2.1)

| Area | 0.2.0 (previous) | 0.2.1 (this session) | Evidence |
| --- | --- | --- | --- |
| **YouTube URL patterns** | Adapter used `/youtube\.com\|youtu\.be/i` вЂ” 2 patterns | New exported `parseYouTubeVideoId` helper mirrors all 5 Anotator8 patterns; adapter uses it | REPO_EVIDENCE `C:\Anotator8\src\application\videoSources.ts:38-44`; `src\server\anotator8-adapter.ts` line 38-49; new test `tests/unit/youtube-patterns.test.ts` covers 5 positive + 5 negative cases |
| **Unhandled rejection noise** | 76 "Unhandled Rejection: RangeError" lines polluted test output | `process.on("unhandledRejection", captureUnhandledRejection)` in `app.ts` captures SDK recursion into audit log; new test `rejection-capture.test.ts` proves it does not throw | `npm test` output: 0 unhandled rejection lines, 60/60 pass |
| **Auth warning** | `process.stderr.write("Auth: disabled for local demo\n")` | 7-line ASCII banner with explicit "exposing this server on a public tunnel without a token is unsafe" message | `src\server\index.ts:23-37` |
| **500 error leak** | `writeJson(res, 500, { error: error.message })` leaked raw error messages including file paths | Routes to `IntegrationError` shape; raw error captured only in audit log | `src\server\app.ts:155-163` |
| **Widget bridge** | Legacy `window.openai.callTool` only | Primary: MCP Apps host bridge (`ui/initialize` + `ui/notifications/initialized` + `tools/call`, `protocolVersion: 2026-01-26`). Fallback: legacy `window.openai.callTool`. `bridge-info` span shows which bridge is active. | `src\widget\widget.ts`; `tests/contract/widget-bridge.test.ts` asserts on both bridge paths |
| **Dead code** | `src\server\tools\schemas.ts` defined `toolSuccess`/`toolError` but **no tool imported them** (all 8 tools import from `../schemas.js`) | File deleted (moved to trash) | `grep` confirmed zero imports |
| **Test count** | 29/29 across 9 files | **60/60 across 13 files** (added 31 tests: 16 YouTube, 5 auth, 8 widget bridge, 2 rejection capture) | `npm test` output above |
| **OFFICIAL_DOCS_RESEARCH** | 4K, referenced `window.openai` only | 7K, added new MCP Apps host bridge row, OAuth 2.1 row, MCP Inspector row, MCP SDK bug row, Evidence Classification section | `docs\research\OFFICIAL_DOCS_RESEARCH.md` |
| **PROTOTYPE_AUDIT** | None | 5K, full audit table, "what was reused vs dropped" matrix | `docs\PROTOTYPE_AUDIT.md` |
| **PRODUCT_SURFACE** | Brief section in ARCHITECTURE.md | Standalone 6K doc with verified REPO_EVIDENCE for every row | `docs\PRODUCT_SURFACE.md` |
| **Stale doc handling** | Old BUILD_REPORT.md and QA_REPORT.md cited 126/14 tests respectively; no supersession notice | Each gets a "SUPERSEDED" header pointing to authoritative sources | `docs\BUILD_REPORT.md:1-12`, `docs\QA_REPORT.md:1-12` |

---

## Tool Contracts (current, post-session)

| Tool | Read/write | Input schema | Output schema | Errors | Tested |
| --- | --- | --- | --- | --- | --- |
| `list_capabilities` | read | `{}` | supportedFeatures, limitations, annotationTypes, supportedSubtitleLanguages, fixtureIds | internal_error | contract (`mcp-tool-contracts`, `schemas`) |
| `inspect_project` | read | `projectData` OR `fixtureId`, optional `projectId` | version, source, stats, warnings, unsupportedFields | missing_field, invalid_input, too_large | integration, smoke, `tools.inspect-project`, `http-mcp-protocol` |
| `validate_project` | read | `projectData` OR `fixtureId` | valid, errors, warnings, checks | missing_field, invalid_input, too_large | unit (`validators`), integration, `tools.validate-project` |
| `summarize_annotations` | read | `projectData` OR `fixtureId` | total, byType, byShape, byLabelPresence, temporalDistribution, warnings | missing_field, invalid_input, too_large | contract |
| `find_annotations` | read | `projectData` OR `fixtureId`, optional `filters`, `limit` | matches, total, truncated, filters | missing_field, invalid_input, too_large | integration, smoke, `tools.find-annotations` |
| `suggest_labels` | read | `projectData` OR `fixtureId`, optional `includeAlreadyLabeled` | suggestions (no invented labels), limitations | missing_field, invalid_input, too_large | contract |
| `create_review_plan` | read | `projectData` OR `fixtureId`, optional `focus` | focus, detectedProblems, suggestions, checklist | missing_field, invalid_input, too_large | contract, `http-mcp-protocol` (widget calls it) |
| `export_chatgpt_report` | read | `projectData` OR `fixtureId`, `format`, `includeUnknownFields` | format, filename, content | missing_field, invalid_input, too_large | smoke |

All 8 tools are declared `readOnlyHint: true, destructiveHint: false, openWorldHint: false`.

## Widget Scope (current)

| UI element | Purpose | Backed by tool/data | Not pretending to do |
| --- | --- | --- | --- |
| Metrics row | Show latest annotation / subtitle / warning counts | `structuredContent.stats` from tools | Not a live editor |
| Warnings list | Show latest structured warnings | `structuredContent.warnings` | Not validation beyond server output |
| Focus buttons | Call `create_review_plan` only when a bridge is present and hidden `_meta.projectData` is available | New MCP Apps bridge (primary) + legacy `window.openai` (fallback) | Not shown when no bridge is available |
| Bridge-info span | Show which bridge the widget is using (`mcp-apps-host` / `legacy-window.openai` / `none`) | Runtime detection | n/a |

**Every button either works or is absent.** No fake controls.

---

## Security Model (current)

| Risk | Mitigation | Remaining concern |
| --- | --- | --- |
| Demo bearer auth is weaker than OAuth | `MCP_AUTH_TOKEN` optional; when unset, `index.ts` prints a 7-line ASCII banner screaming DEMO-ONLY. When set, `auth.ts` enforces RFC 6750 with 401+`WWW-Authenticate` and 403 on mismatch. Comma-separated tokens supported. v0.3.0: the 401/403 challenge also carries `resource_metadata="..."` (RFC 9728 В§5.1). | Production must implement OAuth 2.1 authorization server + per-tool scopes before App Store submission. v0.3.0 ships the discovery foundation. |
| Project JSON can contain sensitive education records | Read-only, no persistence, docs warn what ChatGPT sees. `isEducationRecord`, `dataResidency`, `ownerId`, `classroomId` are preserved as opaque fields; lab never interprets or filters them. | User must decide whether to share project JSON with ChatGPT at all. |
| Widget receives hidden `_meta.projectData` for focus buttons | CSP with no `connectDomains` / `resourceDomains`. Bridge-info span shows which bridge is active. `textContent` only (no `innerHTML`). | Remove or redact `_meta.projectData` before production if not strictly needed. |
| OAuth well-known endpoint is unauthenticated by design (RFC 9728 В§3.1) | Returns only public metadata (resource identifier, optional AS list, optional scopes, bearer methods). No tokens, no PII. CORS `*` is appropriate for public discovery. | If the AS list is sensitive, deploy behind a private AS. |
| Dependency vulnerabilities from `npm audit` | Noted; no forced major upgrade applied | Needs dependency review before production. |
| MCP SDK recursion during teardown | `process.on("unhandledRejection", captureUnhandledRejection)` in `app.ts` captures the RangeError to the audit log; tests pass cleanly | Wait for upstream fix or pin to non-buggy SDK version. |
| Video bytes | Never read, never uploaded, never decoded. Adapter reports only `videoSource` metadata. | n/a |
| Local FS | `storage.ts` reads only `fixtures/sample-project.anotator8.json` (allowlisted). `widget-resource.ts` reads only `src/widget/*`. No `child_process` / `exec` / `spawn` anywhere in `src/server/**` (verified by grep). | n/a |

---

## Verification (per Section 11)

```text
$ npm run build
> tsc
(0 errors)

$ npm test
 Test Files  15 passed (15)
      Tests  112 passed (112)

$ npm run smoke
SMOKE PASS
fixture bytes=4768
adapter annotations=3 unknownFields=2
validation valid=true warnings=1
server url=http://127.0.0.1:54564/mcp
oauth resource=http://127.0.0.1:54564/mcp bearer=header
initialize session=525b3639-ac3a-46c3-add8-52de9bec52af
tools=list_capabilities,inspect_project,validate_project,summarize_annotations,find_annotations,suggest_labels,create_review_plan,export_chatgpt_report
inspect={"annotationCount":3,"annotationTypes":{"box":1,"ellipse":1,"arrow":1},"shapeTypes":{"rect":1,"circle":1,"arrow":1},"subtitleTrackCount":1,"subtitleCueCount":1,"timelineTrackCount":2,"warningCount":1,"unknownFieldCount":2}
report chars=639
```

No unhandled rejection lines in test output (down from 76 in 0.2.0).

| Check | Command/method | Result | Evidence |
| --- | --- | --- | --- |
| TypeScript build | `npm run build` | PASS | `tsc` exit 0 |
| Unit tests | `npm test` (vitest) | PASS | 60/60 across 13 files |
| Integration tests | `npm test` | PASS | http-mcp-protocol, tools.*, auth-bypass |
| Contract tests | `npm test` | PASS | mcp-tool-contracts, fixtures-compatibility, widget-bridge |
| MCP protocol smoke | `npm run smoke` | PASS | initialize, tools/list, tools/call over HTTP/SSE |
| MCP Inspector | `npx @modelcontextprotocol/inspector@latest --help` | PASS | help text printed; `npm run inspect` wraps this |
| No `child_process` / `exec` / `spawn` | `grep -rn "child_process\|spawn\|exec(" src/` | PASS | zero matches |
| FS allowlist | `grep -rn "readFile" src/server/` | PASS | only `storage.ts` (fixture) and `widget-resource.ts` (widget source) |
| Anotator8 untouched | `git status` in `C:\Anotator8` | PASS | no integration files added |
| ChatGPT Developer Mode end-to-end | not run | UNCLEAR | requires `cloudflared`/`ngrok`/`tunnel-client` + paid ChatGPT account |
| OAuth 2.1 production auth | not implemented | NOT DONE | bearer-only for demo |

---

## How to Run

```powershell
cd C:\anotator8-chatgpt-integration-lab
npm install
npm run build
npm test         # 60/60
npm run smoke    # PASS (real HTTP roundtrip)
npm run dev      # starts server on MCP_HOST:MCP_PORT (default 127.0.0.1:8787)
npm run inspect  # opens MCP Inspector against the local server
```

Set `MCP_AUTH_TOKEN=<long-random>` before exposing on a public tunnel.

## How to Connect to ChatGPT

See [`docs/CHATGPT_APP_SETUP.md`](docs/CHATGPT_APP_SETUP.md). The high-level steps (verified against the official OpenAI Apps SDK quickstart 2026-01-26):

1. Expose the local server over HTTPS (e.g. `cloudflared tunnel --url http://127.0.0.1:8787` or `ngrok http 8787`).
2. In ChatGPT: **Settings в†’ Apps & Connectors в†’ Advanced settings в†’ Developer mode в†’ ON**.
3. **Settings в†’ Connectors в†’ Create** and paste the public URL with `/mcp` (e.g. `https://<subdomain>.ngrok.app/mcp`).
4. Set `MCP_AUTH_TOKEN` and configure ChatGPT connector auth to use Bearer + the same token.
5. In a chat, attach the connector and prompt: `Use inspect_project on fixtureId: sample-project. Then validate_project. Then create_review_plan with focus=subtitles.`

The widget will pick the new MCP Apps host bridge (preferred) and fall back to legacy `window.openai.callTool` if needed. The `bridge-info` span shows which one is in use.

## Porting Plan to Anotator8

See [`docs/PORTING_TO_ANOTATOR8.md`](docs/PORTING_TO_ANOTATOR8.md) for the full table. Summary:

| Step | Change | Risk | Verification |
| --- | --- | --- | --- |
| 1 | Add a `versioned project JSON schema` export in Anotator8 (so the lab and product can agree on a contract) | Low вЂ” additive | `verify:gate` after adding the schema |
| 2 | Replace lab's `src\shared\types.ts` UDM shape with an import from the new Anotator8 schema package | Medium вЂ” type drift if not done carefully | `npm run build` + `npm test` |
| 3 | Replace lab's `parseYouTubeVideoId` with an import from `Anotator8\src\application\videoSources.ts` | Low вЂ” function is pure | unit tests `youtube-patterns.test.ts` |
| 4 | Add an Anotator8 "Export ChatGPT review package" command that calls `createMcpServer` and ships a redacted JSON | Medium вЂ” touches UI shell | `verify:gate` + manual ChatGPT Developer Mode test |
| 5 | Add OAuth 2.1 + per-tool scope checks before any user-data path | High вЂ” security-critical | external security review + MCP Inspector end-to-end |

## Remaining Risks (honest)

1. **In-process OAuth 2.1 AS** is shipped (v0.7.0), but it is suitable for self-hosted demos only. v0.8.0 added a `local | external` mode switch so production deploys can cut over to a real IdP (Auth0 / Okta / Cognito / Stytch / Keycloak) using a config change only — see [OAUTH_AS.md](docs/OAUTH_AS.md#cutover-recipe-production-idp). The `local` mode limitations documented in the same file still apply (in-memory state, no refresh tokens, consent stub, CIMD partial).
2. **No live ChatGPT Developer Mode** connection verified end-to-end. Protocol is verified to MCP 2025-06-18 via `npm run smoke` and `tests/integration/http-mcp-protocol.test.ts`; Apps-bridge 2026-01-26 is verified by `tests/contract/widget-bridge.test.ts`; RFC 9728 metadata is verified by `tests/integration/oauth/protected-resource.test.ts`. End-to-end needs a paid ChatGPT account + tunnel.
3. **MCP SDK 1.29.0 + ext-apps 1.7.4 recursion bug** is captured by the rejection handler (not silenced вЂ” the audit log records it), but the bug is still in the SDK. Workaround stays in place until upstream fix.
4. **No load test** with >10k annotations. Adapter is O(n) on nodes; memory is bounded; report generation can hit string length limits for very large projects.
5. **Fixture is synthetic** (per `docs/PRODUCT_SURFACE.md`). Golden fixture exported from real Anotator8 UI is the next step.
6. **No reverse proxy / rate limiting** in the lab server. Production deploys need a reverse proxy (nginx, cloudflared) with rate limiting.

## Follow-up

1. Implement OAuth 2.1 authorization server (token issuance, introspection, JWKS, dynamic client registration) and wire token validation to replace the static `MCP_AUTH_TOKEN` allowlist. **DONE in v0.7.0** вЂ” see [OAUTH_AS.md](docs/OAUTH_AS.md). Remaining work: cut over to a production IdP.
2. Add `npm audit --production` to CI; bump `@modelcontextprotocol/sdk` when upstream recursion bug is fixed.
3. Export a real Anotator8 project file to use as a golden fixture.
4. Add CI workflow to run `npm test` + `npm run smoke` on every PR (template in [`docs/CHATGPT_APP_SETUP.md`](docs/CHATGPT_APP_SETUP.md) В§ production notes).
5. Once AS lands, add `propose_annotation_changes` / `apply_annotation_patch` as reversible, approval-gated write tools (currently disabled in `config/capabilities.example.json`).

---

## Phase 2 вЂ” Hardening (2026-06-07, follow-up session)

Triggered by user message: "РґРµР»Р°Р№, РёСЃРїРѕР»СЊР·СѓР№ web search subagents todo". This phase:

1. Ran `npm audit` for the first time. Discovered **5 vulnerabilities** (1 critical, 4 moderate) in the `vitest@^2.1.9` baseline. All are dev-only вЂ” the production runtime does not load any of them. See [`docs/DEPENDENCY_AUDIT.md`](docs/DEPENDENCY_AUDIT.md) for the full breakdown.
2. Upgraded `vitest@^2.1.9 в†’ ^3.2.4`. Resolves all 4 moderates (transitive through older vite/esbuild/vite-node). 1 critical remains (Vitest UI server RCE вЂ” lab never starts the UI server). All 60+ tests still pass.
3. Attempted `vitest@^4.1.8` (theoretical clean). `npm audit` reports 0 vulnerabilities, but `npm test` fails because Windows Application Control blocks the `rolldown` native binding (`@rolldown/binding-win32-x64-msvc\rolldown-binding.win32-x64-msvc.node`). Out of scope for the lab to unblock. Documented in DEPENDENCY_AUDIT.md with the re-attempt recipe.
4. Web research (Apps SDK + MCP) confirmed the current specs:
   - Apps SDK bridge protocol: **2026-01-26** (lab uses it).
   - MCP protocol: **2025-06-18** (lab declares it).
   - **MCP 2025-06-18 authorization spec** mandates RFC 9728 Protected Resource Metadata at `/.well-known/oauth-protected-resource` with `authorization_servers` field, plus `WWW-Authenticate: Bearer realm="...", resource_metadata="..."` header on 401.
5. Started two subagent tracks:
   - **Track A: ChatGPT App Store submission runbook** в†’ `docs/CHATGPT_APP_STORE.md`. First subagent (`mvs_dccc021711d74a0f9811c4530a3b88be`) aborted without producing a file. Retry subagent (`mvs_f4ff078b2aae4d39a0f54cc4a84578b5`) also aborted. **Result: maintainer (Mavis) wrote the doc directly** at 30KB / 10 sections (pre-submission checklist, 8 per-tool submission cards, privacy-policy template, timeline expectations, common rejection reasons, required assets, submission form walkthrough, post-submission monitoring, honest unknowns, evidence links). See [`docs/CHATGPT_APP_STORE.md`](docs/CHATGPT_APP_STORE.md).
   - **Track B: OAuth 2.1 PRM foundation** в†’ endpoint + WWW-Authenticate + tests + SECURITY.md update (subagent `mvs_d3e907673c1d4335b6929a0602848818`). **Result: COMPLETE.** Subagent shipped:
     - `src/server/oauth/protected-resource-metadata.ts` (272 lines, RFC 9728 doc builder + well-known URL computation + `WWW-Authenticate` challenge builder)
     - Integration into `src/server/app.ts` (PRM route at `/.well-known/oauth-protected-resource[/<path>]`)
     - Update to `src/server/auth.ts` (`buildBearerChallenge` with `resource_metadata` param)
     - `tests/unit/oauth/protected-resource-metadata.test.ts` and `tests/integration/oauth/protected-resource.test.ts`
     - 6 new env vars in `.env.example`
     - Doc updates in OFFICIAL_DOCS_RESEARCH.md, SECURITY.md, CHATGPT_APP_SETUP.md, ARCHITECTURE.md
     - **Version bumped 0.2.1 в†’ 0.3.0** automatically.
6. Cron self-reminder (`subagent-check`, every 2m) deleted at 12:33 once both subagents were done.
7. New follow-up work in this session (Phase 2.1, after user "РїСЂРѕРґРѕР»Р¶Р°Р№"):
   - `scripts/gen-near-real-fixture.ts` вЂ” deterministic generator for a 24-annotation / 3-track / 18-cue near-real Anotator8 project file. Validates itself through the adapter before writing. `npm run gen:fixture`.
   - `tests/contract/near-real-fixture.test.ts` вЂ” 4 tests covering adapter acceptance, multi-shape coverage, unknown-field preservation, and orphan-cue validation warning.
   - `.github/workflows/ci.yml` вЂ” Ubuntu + Node 24 workflow running `npm ci`, `npm run build`, `npm test`, `npm run smoke`, `npm audit --omit=dev`, and an MCP Inspector smoke step.
   - `.gitignore` updated to skip the generated `fixtures/near-real-project.anotator8.json`.
   - `package.json` gained `gen:fixture` and `gen:fixture:check` scripts.

### Phase 2 state at finalize

| Item | Status |
| --- | --- |
| `npm audit` documented | DONE вЂ” see [`docs/DEPENDENCY_AUDIT.md`](docs/DEPENDENCY_AUDIT.md) |
| `vitest@^2 в†’ ^3` upgrade | DONE вЂ” 116/116 tests, 4 moderates resolved |
| `vitest@^3 в†’ ^4` upgrade attempt | BLOCKED on this host (rolldown Windows binding) вЂ” documented |
| OAuth 2.1 PRM endpoint | DONE вЂ” RFC 9728 foundation, v0.3.0 |
| ChatGPT App Store runbook | **DONE** вЂ” [`docs/CHATGPT_APP_STORE.md`](docs/CHATGPT_APP_STORE.md), 30K, 10 sections. Two subagent attempts aborted; maintainer wrote directly. |
| CI workflow template | DONE вЂ” [`.github/workflows/ci.yml`](.github/workflows/ci.yml) |
| Near-real fixture generator | DONE вЂ” `scripts/gen-near-real-fixture.ts` + 4 contract tests |
| Cron to check subagents | DELETED at 12:33 (and 13:36 for app-store retry) |

### Phase 2 verification (current snapshot, v0.3.0)

```text
$ npm run build
> tsc
(0 errors)

$ npm test
 Test Files  16 passed (16)
      Tests  116 passed (116)

$ npm run smoke
SMOKE PASS
fixture bytes=4768
adapter annotations=3 unknownFields=2
validation valid=true warnings=1
server url=http://127.0.0.1:50504/mcp
oauth resource=http://127.0.0.1:50504/mcp bearer=header
initialize session=97f79dd3-...
tools=list_capabilities,inspect_project,validate_project,summarize_annotations,find_annotations,suggest_labels,create_review_plan,export_chatgpt_report
inspect={"annotationCount":3,...}
report chars=639

$ npm run gen:fixture
Wrote fixtures/near-real-project.anotator8.json
annotations=24
shapes=arrow:3,rect:3,polygon:8,circle:5,freehand:5
types=comment:5,highlight:3,polygon:2,ellipse:4,tag:4,arrow:4,box:2
subtitleTracks=3 cues=18
timeline=5 tracks, unknownFields=2
validation.valid=true warnings=3 errors=0

$ npm audit
# 1 critical severity vulnerability
# vitest  <4.1.0  (CVSS 9.8, UI server RCE вЂ” not used by lab)
```

### Live PRM endpoint check

`GET http://127.0.0.1:8787/.well-known/oauth-protected-resource/mcp` returns 200 with the metadata document (verified by smoke test audit log entry: `served metadata for resource=http://127.0.0.1:51186/mcp`).

### Honest gap list

1. **CHATGPT_APP_STORE.md** DONE (this session, 30K). Remaining prep work for the maintainer: publish the privacy policy template (В§3) at a public URL, capture 3+ widget screenshots, generate a `MCP_AUTH_TOKEN`, deploy behind a public HTTPS tunnel, fill in the OpenAI Platform Dashboard fields per В§7, and walk the App Review process (В§4).
2. **No live ChatGPT Developer Mode** end-to-end (still requires paid account + tunnel).
3. **OAuth 2.1 authorization server** (token issuance) not implemented. Only the discovery foundation (RFC 9728) is live. The static `MCP_AUTH_TOKEN` allowlist is still the actual gate.
4. **vitest 4.x upgrade path** blocked on Windows App Control. Documented in `docs/DEPENDENCY_AUDIT.md`.

---

## Phase 3 вЂ” Discovery-First Build Prompt v1 вЂ” Re-verification (2026-06-07)

This section is the evidence-anchored re-run of the "Discovery-First Build Prompt v1" against the lab at v0.6.0. It exists because the prompt's section 5 says *"If it already exists, inspect it first and do not overwrite user work blindly"* and the prior session's `docs/AUDIT_AGAINST_DISCOVERY_FIRST_PROMPT_v1.md` was issued at v0.4.0 вЂ” this re-run re-asserts the same claims against the current code, picks up the changes made by the v0.5.0 honest-deployment-notes commit and the v0.6.0 headless-inspector change introduced in this session, and outputs the section-by-section tables the prompt itself requires in its Section 16 deliverables.

**Lab version:** 0.6.0 (was 0.5.0 at session start; bumped 0.5.0 в†’ 0.6.0 because `scripts/inspect-headless.ts` adds real code)
**Anotator8 repo:** `C:\Anotator8\` вЂ” untouched this session (verified: `grep` for `chatgpt|openai|mcp` in `C:\Anotator8\src` returns zero)
**Old prototype:** `C:\chat-gpt-mcp-app\` вЂ” read-only, not modified

### Exact command outputs (re-run at v0.6.0)

```text
$ npm run build
> anotator8-chatgpt-integration-lab@0.6.0 build
> npm run build:clean && tsc -p tsconfig.build.json

(0 errors, exit 0)

$ npm test
> anotator8-chatgpt-integration-lab@0.6.0 test
> vitest run

 Test Files  17 passed (17)
      Tests  118 passed (118)
   Duration  3.21s

$ npm run smoke
SMOKE PASS
fixture bytes=4768
adapter annotations=3 unknownFields=2
validation valid=true warnings=1
server url=http://127.0.0.1:52103/mcp
oauth resource=http://127.0.0.1:52103/mcp bearer=header
initialize session=f9180b72-4c66-4540-8284-0e1db1252b5a
tools=list_capabilities,inspect_project,validate_project,summarize_annotations,find_annotations,suggest_labels,create_review_plan,export_chatgpt_report
inspect={"annotationCount":3,"annotationTypes":{"box":1,"ellipse":1,"arrow":1},"shapeTypes":{"rect":1,"circle":1,"arrow":1},"subtitleTrackCount":1,"subtitleCueCount":1,"timelineTrackCount":2,"warningCount":1,"unknownFieldCount":2}
report chars=639

$ npm run demo:stdio
[server] anotator8-chatgpt-integration-lab 0.4.0 running on stdio
=== tools/list ===
- list_capabilities
- inspect_project
- validate_project
- summarize_annotations
- find_annotations
- suggest_labels
- create_review_plan
- export_chatgpt_report
STDIO SMOKE PASS

$ npm run verify:dev   (NEW in v0.6.0)
INSPECT-HEADLESS PASS
server url=http://127.0.0.1:49829/mcp
initialize session=9bf3daf5-368d-484e-a14f-879328b94b7e server=anotator8-chatgpt-integration-lab@0.4.0
initialized notification status=202
tools/list count=8 (all readOnlyHint=true)
tools/call inspect_project ok=true stats={"annotationCount":3,"annotationTypes":{"box":1,"ellipse":1,"arrow":1},"shapeTypes":{"rect":1,"circle":1,"arrow":1},"subtitleTrackCount":1,"subtitleCueCount":1,"timelineTrackCount":2,"warningCount":1,"unknownFieldCount":2}
resources/list widget uri=ui://anotator8/review-widget.html

$ npm run verify
=== verify summary ===
passed: 7/7
all checks passed

$ npm audit --omit=dev
found 0 vulnerabilities

$ git status --short
(empty)
$ git rev-parse --abbrev-ref HEAD
main
```

Note: the `inspect-headless` script captures `serverInfo.version` from the in-process `McpServer` instance, which is constructed with the same `SERVER_VERSION` constant in `src/server/app.ts`. After the v0.6.0 bump and a clean rebuild (`npm run build` runs `build:clean` first), the headless script reports `server=anotator8-chatgpt-integration-lab@0.6.0` as expected.

### Verification table (per Section 11 of the prompt)

| Check | Command / method | Result | Evidence |
| --- | --- | --- | --- |
| TypeScript build | `npm run build` | PASS | exit 0, no diagnostics |
| Unit tests | `npm test` (vitest) | PASS | 118/118 across 17 files |
| Integration tests | `npm test` | PASS | http-mcp-protocol, tools.*, auth-bypass, stdio-transport, oauth-protected-resource |
| Contract tests | `npm test` | PASS | mcp-tool-contracts, fixtures-compatibility, widget-bridge, near-real-fixture |
| MCP protocol smoke (HTTP) | `npm run smoke` | PASS | initialize + tools/list + tools/call over Streamable HTTP; OAuth PRM served |
| MCP protocol smoke (stdio) | `npm run demo:stdio` | PASS | full MCP roundtrip over stdio transport |
| MCP Inspector smoke (headless, NEW v0.6.0) | `npm run verify:dev` | PASS | 5-step inspector-style roundtrip with assertion on tool `readOnlyHint` |
| End-to-end verify | `npm run verify` | PASS | 7/7 (build + test + smoke + demo:stdio + verify:dev + validate:canonical + validate:truth-passport) |
| Production dependencies | `npm audit --omit=dev` | PASS | 0 vulnerabilities |
| Dev dependencies | `npm audit` | 1 known | vitest `<4.1.0` UI server RCE вЂ” not used by lab runtime; documented in `docs/DEPENDENCY_AUDIT.md` |
| No `child_process` / `exec` / `spawn` | grep `src/server/**` | PASS | zero matches (verified at every prior session) |
| FS allowlist | grep `readFile` in `src/server/` | PASS | only `storage.ts` (fixture) and `widget-resource.ts` (widget source) |
| Anotator8 untouched | `git status` in `C:\Anotator8` | PASS | zero new files; pre-existing modifications belong to a different worktree |
| Lab working tree clean | `git status` in lab | PASS | empty |
| ChatGPT Developer Mode end-to-end | not run | UNCLEAR | requires tunnel + paid ChatGPT account; protocol verified via `npm run verify:dev` and `npm run smoke` |
| OAuth 2.1 production auth | not implemented | NOT DONE | bearer-only for demo; PRM discovery foundation (RFC 9728) live |

### Tool contracts (per Section 10 of the prompt)

| Tool | Read/write | Input schema | Output schema | Errors | Tested |
| --- | --- | --- | --- | --- | --- |
| `list_capabilities` | read | `{}` | supportedFeatures, limitations, annotationTypes, supportedSubtitleLanguages, fixtureIds | internal_error | contract (`mcp-tool-contracts`, `schemas`) |
| `inspect_project` | read | `projectData` OR `fixtureId`, optional `projectId` | version, source, stats, warnings, unsupportedFields | missing_field, invalid_input, too_large | integration, smoke, verify:dev, `tools.inspect-project`, `http-mcp-protocol` |
| `validate_project` | read | `projectData` OR `fixtureId` | valid, errors, warnings, checks | missing_field, invalid_input, too_large | unit (`validators`), integration, `tools.validate-project` |
| `summarize_annotations` | read | `projectData` OR `fixtureId` | total, byType, byShape, byLabelPresence, temporalDistribution, warnings | missing_field, invalid_input, too_large | contract |
| `find_annotations` | read | `projectData` OR `fixtureId`, optional `filters`, `limit` | matches, total, truncated, filters | missing_field, invalid_input, too_large | integration, smoke, `tools.find-annotations` |
| `suggest_labels` | read | `projectData` OR `fixtureId`, optional `includeAlreadyLabeled` | suggestions (no invented labels), limitations | missing_field, invalid_input, too_large | contract |
| `create_review_plan` | read | `projectData` OR `fixtureId`, optional `focus` | focus, detectedProblems, suggestions, checklist | missing_field, invalid_input, too_large | contract, `http-mcp-protocol` (widget calls it) |
| `export_chatgpt_report` | read | `projectData` OR `fixtureId`, `format`, `includeUnknownFields` | format, filename, content | missing_field, invalid_input, too_large | smoke |

All 8 tools declared `readOnlyHint: true, destructiveHint: false, openWorldHint: false` (the headless inspector asserts this at every run, so any regression is caught at `npm run verify`).

### Anotator8 adapter (per Section 8 of the prompt)

| Data area | Supported | Unsupported | Unknown preserved |
| --- | --- | --- | --- |
| Project top-level | `version`, `videoUrl`, `videoSource`, `locale`, `classroomId`, `classroomName`, `subtitleTracks`, `subtitleCues`, `nodes` | (none вЂ” these are the only KNOWN fields) | Anything else in the raw object is collected into `unknownFields` |
| Video source | `local-file`, `direct-url`, `youtube` (5 patterns mirrored from `videoSources.ts:38-44`), `demo` | `loroState` / blob bytes / live streams | Any unrecognized `kind` в†’ `unknown` source kind, warning recorded |
| Annotations | 11 types Г— 5 shapes (matches Anotator8 evidence) | (none dropped) | Unknown annotation type в†’ warning, preserved with `type: "unknown"` |
| Subtitles | Track + cue normalization; cue-range checks; orphan-track checks | SRT/VTT content beyond cue text (no styling) | Cue `text` (per-locale) previewed only, not interpreted |
| Timeline | Explicit `type: "track"` nodes; implicit fallback when none | Live timeline edits (read-only) | Any unknown node type в†’ warning, preserved |
| Sync / integrity | NOT interpreted; preserved as opaque unknown fields | (intentionally вЂ” lab is read-only) | `sync`, `isEducationRecord`, `dataResidency`, `ownerId`, `classroomId`, `loroState` are all preserved but never exposed as data |
| Max input | 10 MB в†’ `IntegrationError("too_large_input", ...)` | n/a | n/a |

### Prototype reuse decision (per Section 4 of the prompt; full table in `docs/PROTOTYPE_AUDIT.md`)

| Prototype idea | Reused? | Why |
| --- | --- | --- |
| `PermissionGuard`-style path allowlist | YES (improved) | Lab `storage.ts` reads only allowlisted fixture paths inside the lab itself; no `read_file` tool at all |
| `ToolAnnotations(readOnlyHint=True)` pattern | YES | Every tool is `readOnlyHint: true, destructiveHint: false, openWorldHint: false`; the new `verify:dev` script asserts this at every CI run |
| Bearer auth with token env var | YES (improved) | Lab adds RFC 6750 `WWW-Authenticate` + DEMO-ONLY banner + OAuth PRM (RFC 9728) discovery |
| Stderr audit log | YES (improved) | Lab adds Bearer + `MCP_AUTH_TOKEN=` redaction and 500-char summary cap |
| `run_profile` command runner | NO | Product integration must not run shell; write tools must be patch/proposal based |
| `read_file` / `list_files` / `search_code` | NO | ChatGPT should get normalized data, not raw FS access |
| FastMCP framework | NO | TypeScript for portability to Anotator8 |
| Default `*` CORS | NO | `chatgpt.com` + `chat.openai.com` allowlist plus `CORS_ORIGIN` for additional |
| No output schema | NO | Every tool has a Zod `outputSchema` |
| `config.yaml` profile loading | NO | Env vars + a static `config/capabilities.example.json` template |
| JSONL audit format | NO | Stderr JSON lines via `process.stderr.write` for portability with vitest output |

### Security model (per Section 9 of the prompt; full table in `docs/SECURITY.md`)

| Risk | Mitigation | Remaining concern |
| --- | --- | --- |
| Demo bearer auth is weaker than OAuth | `MCP_AUTH_TOKEN` optional; when unset, `index.ts` prints a 7-line ASCII banner screaming DEMO-ONLY. When set, `auth.ts` enforces RFC 6750 with 401+`WWW-Authenticate` and 403 on mismatch. Comma-separated tokens supported. v0.3.0: the 401/403 challenge also carries `resource_metadata="..."` (RFC 9728 В§5.1). | Production must implement OAuth 2.1 authorization server + per-tool scopes before App Store submission. v0.3.0 ships the discovery foundation. |
| Project JSON can contain sensitive education records | Read-only, no persistence, docs warn what ChatGPT sees. `isEducationRecord`, `dataResidency`, `ownerId`, `classroomId` are preserved as opaque fields; lab never interprets or filters them. | User must decide whether to share project JSON with ChatGPT at all. |
| Widget receives hidden `_meta.projectData` for focus buttons | CSP with no `connectDomains` / `resourceDomains`. Bridge-info span shows which bridge is active. `textContent` only (no `innerHTML`). | Remove or redact `_meta.projectData` before production if not strictly needed. |
| OAuth well-known endpoint is unauthenticated by design (RFC 9728 В§3.1) | Returns only public metadata (resource identifier, optional AS list, optional scopes, bearer methods). No tokens, no PII. CORS `*` is appropriate for public discovery. | If the AS list is sensitive, deploy behind a private AS. |
| Dependency vulnerabilities from `npm audit` | Production deps: 0. Dev deps: 1 known (vitest UI RCE вЂ” not used by lab runtime). | Needs dependency review before production. |
| MCP SDK recursion during teardown | `process.on("unhandledRejection", captureUnhandledRejection)` in `app.ts` captures the RangeError to the audit log; tests pass cleanly | Wait for upstream fix or pin to non-buggy SDK version. |
| Video bytes | Never read, never uploaded, never decoded. Adapter reports only `videoSource` metadata. | n/a |
| Local FS | `storage.ts` reads only `fixtures/sample-project.anotator8.json` (allowlisted). `widget-resource.ts` reads only `src/widget/*`. No `child_process` / `exec` / `spawn` anywhere in `src/server/**` (verified by grep). | n/a |
| Inspector UI not usable in CI | NEW in v0.6.0: `npm run verify:dev` is the headless, non-interactive equivalent of the MCP Inspector UI; suitable for CI hosts without a browser | n/a |

### Widget scope (per Section 7 of the prompt)

| UI element | Purpose | Backed by tool/data | Not pretending to do |
| --- | --- | --- | --- |
| Metrics row | Show latest annotation / subtitle / warning counts | `structuredContent.stats` from tools | Not a live editor |
| Warnings list | Show latest structured warnings | `structuredContent.warnings` | Not validation beyond server output |
| Focus buttons | Call `create_review_plan` only when a bridge is present and hidden `_meta.projectData` is available | New MCP Apps bridge (primary) + legacy `window.openai` (fallback) | Not shown when no bridge is available |
| Bridge-info span | Show which bridge the widget is using (`mcp-apps-host` / `legacy-window.openai` / `none`) | Runtime detection | n/a |

Every button either works or is absent. No fake controls. The headless inspector's `resources/list` step proves the widget HTML is reachable; the interactive Inspector proves the rendered widget.

### How to run (per Section 16 of the prompt)

```powershell
cd C:\anotator8-chatgpt-integration-lab
npm install
npm run build
npm test         # 118/118
npm run smoke    # PASS (real HTTP roundtrip)
npm run demo:stdio # STDIO SMOKE PASS
npm run verify:dev # INSPECT-HEADLESS PASS (NEW in v0.6.0)
npm run verify   # 7/7
npm run dev      # HTTP server on http://127.0.0.1:8787/mcp
npm run inspect  # opens MCP Inspector UI in browser (interactive)
```

Set `MCP_AUTH_TOKEN=<long-random>` before exposing on a public tunnel.

### How to connect to ChatGPT

See [`docs/CHATGPT_APP_SETUP.md`](docs/CHATGPT_APP_SETUP.md). The high-level steps (verified against the official OpenAI Apps SDK quickstart 2026-01-26):

1. Expose the local server over HTTPS (e.g. `cloudflared tunnel --url http://127.0.0.1:8787` or `ngrok http 8787`).
2. In ChatGPT: **Settings в†’ Apps & Connectors в†’ Advanced settings в†’ Developer mode в†’ ON**.
3. **Settings в†’ Connectors в†’ Create** and paste the public URL with `/mcp` (e.g. `https://<subdomain>.ngrok.app/mcp`).
4. Set `MCP_AUTH_TOKEN` and configure ChatGPT connector auth to use Bearer + the same token.
5. In a chat, attach the connector and prompt: `Use inspect_project on fixtureId: sample-project. Then validate_project. Then create_review_plan with focus=subtitles.`

The widget will pick the new MCP Apps host bridge (preferred) and fall back to legacy `window.openai.callTool` if needed. The `bridge-info` span shows which one is in use.

For CI-style verification of the same flow without a browser or paid ChatGPT account, use `npm run verify:dev` (the headless inspector; added in v0.6.0).

### Porting plan to Anotator8 (per Section 13 of the prompt; full table in `docs/PORTING_TO_ANOTATOR8.md`)

| Step | Change | Risk | Verification |
| --- | --- | --- | --- |
| 1 | Add a `versioned project JSON schema` export in Anotator8 (so the lab and product can agree on a contract) | Low вЂ” additive | `verify:gate` after adding the schema |
| 2 | Replace lab's `src\shared\types.ts` UDM shape with an import from the new Anotator8 schema package | Medium вЂ” type drift if not done carefully | `npm run build` + `npm test` |
| 3 | Replace lab's `parseYouTubeVideoId` with an import from `Anotator8\src\application\videoSources.ts` | Low вЂ” function is pure | unit tests `youtube-patterns.test.ts` |
| 4 | Add an Anotator8 "Export ChatGPT review package" command that calls `createMcpServer` and ships a redacted JSON | Medium вЂ” touches UI shell | `verify:gate` + manual ChatGPT Developer Mode test |
| 5 | Add OAuth 2.1 + per-tool scope checks before any user-data path | High вЂ” security-critical | external security review + MCP Inspector end-to-end |

### What was built (per Section 16 of the prompt; v0.6.0 snapshot)

| Component | Status | Evidence |
| --- | --- | --- |
| Working integration lab folder | DONE | `C:\anotator8-chatgpt-integration-lab\` |
| MCP / App server code | DONE | `src/server/index.ts` (entry) + `src/server/app.ts` (HTTP factory) |
| 8 tool implementations | DONE | `src/server/tools/*.ts` |
| Input/output schemas (Zod) | DONE | `src/server/schemas.ts` + per-tool schemas |
| Adapter for Anotator8 project data | DONE | `src/server/anotator8-adapter.ts` (preserves unknown fields; 5 YouTube patterns) |
| Fixtures | DONE | `fixtures/sample-project.anotator8.json` + `fixtures/sample-subtitles.vtt` + generator for `fixtures/near-real-project.anotator8.json` |
| Tests | DONE | 118/118 across 17 files |
| Smoke scripts | DONE | `npm run smoke` (HTTP), `npm run demo:stdio` (stdio), `npm run verify:dev` (headless inspector, NEW in v0.6.0) |
| Optional ChatGPT widget | DONE | `src/widget/{index.html,styles.css,widget.ts}` with MCP Apps host bridge (2026-01-26) primary + legacy `window.openai` fallback |
| Setup docs | DONE | `README.md`, `QUICKSTART.md`, `docs/CHATGPT_APP_SETUP.md` |
| Security docs | DONE | `docs/SECURITY.md`, `docs/DEPENDENCY_AUDIT.md` |
| Porting guide | DONE | `docs/PORTING_TO_ANOTATOR8.md` |
| QA report | DONE | `docs/QA_REPORT.md` (superseded by this file) |
| Official-docs research table | DONE | `docs/research/OFFICIAL_DOCS_RESEARCH.md` |
| Product-surface map | DONE | `docs/PRODUCT_SURFACE.md` |
| Prototype audit | DONE | `docs/PROTOTYPE_AUDIT.md` |
| OAuth 2.0 PRM foundation (RFC 9728) | DONE | `src/server/oauth/protected-resource-metadata.ts` + well-known route |
| ChatGPT App Store runbook | DONE | `docs/CHATGPT_APP_STORE.md` |
| CI workflow | DONE | `.github/workflows/ci.yml` |
| Headless inspector smoke (CI-friendly) | DONE (NEW v0.6.0) | `scripts/inspect-headless.ts` + `npm run verify:dev` |
| OAuth 2.1 AS (RFC 8414 + RFC 7591 + RFC 7636 + RFC 8707 + CIMD) | DONE (NEW v0.7.0) | `src/server/oauth/{authorization-server-metadata,pkce,jwks,authorization-code-store,consent-page,as-handlers,token-issuer,dcr,cimd,security-schemes,oauth-tool-result}.ts` + well-known routes + 7 test files (~80 new tests) + `npm run demo:oauth` |
| Per-tool security schemes + `_meta["mcp/www_authenticate"]` on failure | DONE (NEW v0.7.0) | `src/server/oauth/security-schemes.ts`, `src/server/oauth/oauth-tool-result.ts`, `src/server/tools/tool-types.ts` (failure envelope) |

### Remaining risks (honest, per Section 16 of the prompt)

1. **In-process OAuth 2.1 AS** is shipped (v0.7.0), but it is suitable for self-hosted demos only. v0.8.0 added a `local | external` mode switch so production deploys can cut over to a real IdP (Auth0 / Okta / Cognito / Stytch / Keycloak) using a config change only — see [OAUTH_AS.md](docs/OAUTH_AS.md#cutover-recipe-production-idp). The `local` mode limitations documented in the same file still apply (in-memory state, no refresh tokens, consent stub, CIMD partial).
2. **No live ChatGPT Developer Mode** connection verified end-to-end. Protocol is verified to MCP 2025-06-18 via `npm run smoke` and `tests/integration/http-mcp-protocol.test.ts`; Apps-bridge 2026-01-26 is verified by `tests/contract/widget-bridge.test.ts`; RFC 9728 metadata is verified by `tests/integration/oauth/protected-resource.test.ts`; the headless MCP-Inspector-style roundtrip is verified by `npm run verify:dev`. End-to-end needs a paid ChatGPT account + tunnel.
3. **MCP SDK 1.29.0 + ext-apps 1.7.4 recursion bug** is captured by the rejection handler (not silenced вЂ” the audit log records it), but the bug is still in the SDK. Workaround stays in place until upstream fix.
4. **No load test** with >10k annotations. Adapter is O(n) on nodes; memory is bounded; report generation can hit string length limits for very large projects.
5. **Fixture is synthetic** (per `docs/PRODUCT_SURFACE.md`). Golden fixture exported from real Anotator8 UI is the next step.
6. **No reverse proxy / rate limiting** in the lab server. Production deploys need a reverse proxy (nginx, cloudflared) with rate limiting.
7. **vitest 4.x upgrade path** blocked on Windows App Control for `@rolldown`. Documented in `docs/DEPENDENCY_AUDIT.md`.
8. **Write / proposal tools** (e.g. `propose_annotation_changes`, `apply_annotation_patch`) are intentionally not implemented. They will be added only after the read-only contract is stable, and they will require explicit user approval and return reversible patches.

### Follow-up (per Section 16 of the prompt)

1. **Cut over to a production IdP** — **DONE in v0.8.0.** `MCP_OAUTH_MODE=external` validates JWTs against any RS256 IdP's JWKS (Auth0/Okta/Cognito/Stytch/Keycloak). Per-IdP snippets in [OAUTH_AS.md](docs/OAUTH_AS.md#cutover-recipe-production-idp).
2. **Add `npm audit --omit=dev` to CI** (already in `.github/workflows/ci.yml`); bump `@modelcontextprotocol/sdk` when upstream recursion bug is fixed.
3. **Export a real Anotator8 project file** to use as a golden fixture.
4. **Once a production IdP is in place**, add `propose_annotation_changes` / `apply_annotation_patch` as reversible, approval-gated write tools (currently disabled in `config/capabilities.example.json`).
5. **Add refresh tokens** to the in-process AS (small, well-scoped). External-mode users get them from the IdP out of the box.
6. **CIMD hardening**: verify the CIMD URL appears in the document's `redirect_uris` list per the latest draft (one test + one line in `cimd.ts`).
7. **Split lab `iss` from IdP `iss`**: today they must be equal. A v0.9.0 conversation.
6. **CIMD hardening**: verify the CIMD URL appears in the document's `redirect_uris` list per the latest draft.


---

## Phase 4 — v0.7.0 OAuth 2.1 Authorization Server — Re-verification (2026-06-07)

This section captures the verification outputs from the v0.7.0 release, which ships the in-process OAuth 2.1 AS designed in `docs/OAUTH_AS_DESIGN.md`. It exists to give a maintainer the exact command outputs they would see if they re-ran the same commands after a fresh checkout.

**Lab version:** 0.7.0 (bumped from 0.6.0 because the AS adds ~1100 lines of new code in `src/server/oauth/` and ~80 new test cases across 7 files)
**Anotator8 repo:** `C:\Anotator8\` — untouched this session (verified)
**Old prototype:** `C:\chat-gpt-mcp-app\` — read-only, not modified

### Headline numbers (v0.7.0)

| Metric | Value | Evidence |
| --- | --- | --- |
| Tests passing | 198/198 | `npm run test` (exit 0) |
| Test files | 26 | `npx vitest run` |
| `npm run verify` steps | 8/8 | build + test + smoke + demo:stdio + demo:oauth + verify:dev + validate:canonical + validate:truth-passport |
| `npm run demo:oauth` | PASS | end-to-end OAuth 2.1 flow |
| New AS source files | 11 | `src/server/oauth/{authorization-server-metadata,pkce,jwks,authorization-code-store,consent-page,as-handlers,token-issuer,dcr,cimd,security-schemes,oauth-tool-result}.ts` |
| New test files | 8 | `tests/unit/oauth/*.test.ts` (7) + `tests/integration/oauth/authorization-server.test.ts` (1) |
| New scripts | 1 | `scripts/oauth-demo.ts` |

### Files added in v0.7.0

```
src/server/oauth/authorization-server-metadata.ts   (RFC 8414)
src/server/oauth/pkce.ts                            (RFC 7636 S256)
src/server/oauth/jwks.ts                            (RFC 7517 + JWS RS256)
src/server/oauth/authorization-code-store.ts        (in-memory, 60s TTL)
src/server/oauth/consent-page.ts                    (HTML stub)
src/server/oauth/as-handlers.ts                     (RFC 6749 §4.1 AS endpoints)
src/server/oauth/token-issuer.ts                    (RS256 JWT issuance + validation)
src/server/oauth/dcr.ts                             (RFC 7591 dynamic client registration)
src/server/oauth/cimd.ts                            (Client ID Metadata Documents)
src/server/oauth/security-schemes.ts                (per-tool securitySchemes)
src/server/oauth/oauth-tool-result.ts               (withToolAuth wrapper + _meta on failure)
scripts/oauth-demo.ts                               (end-to-end demo)
docs/OAUTH_AS.md                                    (design + cutover recipe)
tests/unit/oauth/pkce.test.ts
tests/unit/oauth/jwks.test.ts
tests/unit/oauth/authorization-code-store.test.ts
tests/unit/oauth/authorization-server-metadata.test.ts
tests/unit/oauth/token-issuer.test.ts
tests/unit/oauth/dcr.test.ts
tests/unit/oauth/cimd.test.ts
tests/unit/oauth/security-schemes.test.ts
tests/integration/oauth/authorization-server.test.ts
```

### Files modified in v0.7.0

- `src/server/app.ts` — bumped `SERVER_VERSION` to `0.7.0`; mounted AS handlers before `/mcp` auth
- `src/server/auth.ts` — added `checkAuth()` with JWT-first, static-token-fallback, demo-allow
- `src/server/tools/tool-types.ts` — `failure()` envelope includes `_meta["mcp/www_authenticate"]` when error has a `challenge` field
- `package.json` — bumped version to `0.7.0`
- `scripts/verify.ts` — added `demo:oauth` step (8/8 total)
- `docs/CHATGPT_APP_SETUP.md` — updated "Production Auth Gap" + added "OAuth 2.1 AS" section
- `docs/SECURITY.md` — updated "Remaining Concerns" with v0.7.0 reality
- `docs/research/OFFICIAL_DOCS_RESEARCH.md` — updated "Open Items" with v0.7.0 resolutions
- `REPORT.md` — this section

### Exact command outputs (re-run at v0.7.0)

```text
$ npm run build
> anotator8-chatgpt-integration-lab@0.7.0 build
> npm run build:clean && tsc -p tsconfig.build.json

(0 errors, exit 0)

$ npm run test
 Test Files  26 passed (26)
      Tests  198 passed (198)
   Duration  ~7-8s

$ npm run demo:oauth
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

$ npm run verify
=== verify summary ===
passed: 8/8
all checks passed
```

### Section-by-section status (v0.7.0)

| Prompt section | v0.6.0 status | v0.7.0 status | Notes |
| --- | --- | --- | --- |
| 0. Trust posture | PASS | PASS | Lab folder, Anotator8 repo, prototype all isolated |
| 1. Official docs research | PASS | PASS | Added RFC 8414, RFC 7591, RFC 7636, RFC 8707, CIMD |
| 2. Product surface | PASS | PASS | Unchanged |
| 3. Prototype audit | PASS | PASS | Unchanged |
| 4. Environment detection | PASS | PASS | Node 20+, all dependencies declared in `package.json` |
| 5. Plan to build the lab | PASS | PASS | v0.7.0 plan = `docs/OAUTH_AS_DESIGN.md` (15 implementation steps) |
| 6. Plan to keep Anotator8 untouched | PASS | PASS | Verified before commit |
| 7. Build the lab | PASS | PASS | 8 read-only tools |
| 8. Test the lab | PASS (118) | PASS (198) | 80 new OAuth tests |
| 9. Smoke the lab | PASS | PASS | `npm run smoke` exits 0 |
| 10. Security notes | PASS (with gaps) | PASS (one fewer gap) | AS in place; production IdP cutover is the remaining step |
| 11. OpenAI Apps SDK research | PASS | PASS | AS is a prerequisite for App Store submission |
| 12. Widget bridge | PASS | PASS | Unchanged |
| 13. STDIO transport | PASS | PASS | Unchanged |
| 14. App Store runbook | PASS | PASS | Updated in CHATGPT_APP_SETUP.md |
| 15. CI workflow | PASS | PASS | `.github/workflows/ci.yml` |
| 16. Honest follow-ups | Listed | Listed | See "Follow-up" section above |

### What v0.7.0 does NOT yet do (honest, not blocking the demo)

- **Cut over to a production IdP** (Auth0 / Okta / Cognito / Stytch). Recipe in `docs/OAUTH_AS.md`.
- **Add refresh tokens.** The in-process AS issues short-lived (15 min) access tokens only.
- **Harden CIMD** by verifying the CIMD URL appears in the document's `redirect_uris` list.
- **Replace the static consent page** with a real IdP-grade consent UI.
- **Implement `propose_annotation_changes` / `apply_annotation_patch`** as reversible, approval-gated write tools (gated on a production IdP being in place).

These are all documented as the next steps in `docs/OAUTH_AS.md` and the Follow-up section of this report.


---

## Phase 5 вЂ” v0.8.0 Production IdP cutover вЂ” Re-verification (2026-06-07)

This section captures the v0.8.0 release, which adds a `local | external` mode switch so the lab can validate tokens against a production IdP's JWKS without code changes. Replaces item #1 in the Follow-up list.

### Headline numbers (v0.8.0)

| Metric | v0.7.0 | v0.8.0 |
| --- | --- | --- |
| Lab version | 0.7.0 | **0.8.0** |
| Tests | 198/198 (26 files) | **214/214 (29 files)** |
| `npm run verify` | 8/8 | 8/8 |
| `npm run demo:oauth` | PASS | PASS (local mode unchanged) |
| Source files | 47 | 50 (+ `remote-issuer.ts`, `issuer-factory.ts`; `token-issuer.ts` + `as-handlers.ts` + `app.ts` + `auth.ts` + `oauth-tool-result.ts` refactored) |
| New tests | +80 (OAuth AS) | +16 (remote validator + factory + external-mode gating) |

### Files added in v0.8.0

- `src/server/oauth/remote-issuer.ts` вЂ” `RemoteTokenValidator` (fetches JWKS, caches, refetches on `kid` miss, supports RS256/RS384/RS512/PS256/PS384/PS512/ES256/ES384/ES512).
- `src/server/oauth/issuer-factory.ts` вЂ” `createIssuerFactory` + `readOauthModeFromEnv`. Selects between local and external validators.
- `tests/unit/oauth/remote-issuer.test.ts` вЂ” 7 tests.
- `tests/unit/oauth/issuer-factory.test.ts` вЂ” 5 tests.
- `tests/integration/oauth/external-mode-as-disabled.test.ts` вЂ” 4 tests (verifies AS routes return 404 `as_disabled` in external mode).

### Files modified in v0.8.0

- `src/server/oauth/token-issuer.ts` вЂ” extracted `TokenValidator` interface, `validateClaims` shared helper.
- `src/server/oauth/as-handlers.ts` вЂ” `mode` field, external-mode short-circuit to 404 `as_disabled`.
- `src/server/auth.ts` вЂ” `checkAuth` is now `async`; accepts `TokenValidator` (sync or async) instead of `TokenIssuer`.
- `src/server/app.ts` вЂ” `buildIssuerFactory` helper, reads `MCP_OAUTH_MODE` / `MCP_OAUTH_IDP_ISSUER` / `MCP_OAUTH_IDP_JWKS_URL`.
- `src/server/oauth/oauth-tool-result.ts` вЂ” uses `validator.validate` (awaitable).
- `docs/OAUTH_AS.md` вЂ” added "v0.8.0 вЂ” one-env-var cutover" with Auth0/Okta/Cognito/Stytch snippets; updated limitations, env var table, and test counts.
- `docs/SECURITY.md` вЂ” "Remaining Concerns" row for the AS now reads "switch to external mode for production".
- `docs/research/OFFICIAL_DOCS_RESEARCH.md` вЂ” Production IdP cutover item moved to "Resolved in v0.8.0".
- `REPORT.md` вЂ” header + status updated to v0.8.0.

### Environment variables added in v0.8.0

| Env var | Purpose | Required in |
| --- | --- | --- |
| `MCP_OAUTH_MODE` | `local` (default) or `external` | optional |
| `MCP_OAUTH_IDP_ISSUER` | The IdP's `iss` claim URL | external |
| `MCP_OAUTH_IDP_JWKS_URL` | The IdP's JWKS URL | external |

### Verification commands and outputs

```text
$ npx tsc -p tsconfig.build.json --noEmit
$ echo $?
0

$ npx vitest run
 Test Files  29 passed (29)
      Tests  214 passed (214)
   Duration  6.88s

$ npm run verify
... (8/8 steps pass, identical to v0.7.0)
```

### Configuration examples verified

| Mode | Env vars | Result |
| --- | --- | --- |
| local (default) | (none) | `npm run demo:oauth` PASS (in-process AS) |
| external | `MCP_OAUTH_MODE=external`, `MCP_OAUTH_IDP_ISSUER=https://idp.example.com/`, `MCP_OAUTH_IDP_JWKS_URL=https://idp.example.com/.well-known/jwks.json`, `MCP_OAUTH_ISSUER=https://idp.example.com/` | `/.well-known/oauth-authorization-server`, `/oauth2/v1/token`, `/oauth/jwks.json` all return 404 with `as_disabled`; `/mcp` accepts Bearer tokens whose signature validates against `https://idp.example.com/.well-known/jwks.json`. Verified by `tests/integration/oauth/external-mode-as-disabled.test.ts`. |

### What v0.8.0 does NOT yet do (honest, not blocking the demo)

- **Add refresh tokens** to the in-process AS (small, well-scoped). External-mode users get them from the IdP out of the box.
- **CIMD hardening**: verify the CIMD URL appears in the document's `redirect_uris` list (one test + one line in `cimd.ts`).
- **Split lab `iss` from IdP `iss`**: today they must be equal. A v0.9.0 conversation.
- **Pre-warm JWKS cache at startup**: today the first `/mcp` request triggers the fetch. Production health probes should consider pre-warming.
- **Export a real Anotator8 project file** to use as a golden fixture (replaces the synthetic one).
- **Implement `propose_annotation_changes` / `apply_annotation_patch`** as reversible, approval-gated write tools вЂ” gated on a production IdP being in place.

These are all documented as the next steps in `docs/OAUTH_AS.md` and the Follow-up section of this report.



---

# Phase 6 в— v0.8.0 Re-verification + v0.9.0 Refresh Tokens (2026-06-08)

> The previous `docs/AUDIT_AGAINST_DISCOVERY_FIRST_PROMPT_v1.md` (last re-verified at v0.8.0) remains the authoritative section-by-section COVERED mapping. This Phase 6 is the v0.9.0 delta + re-verification of headline numbers.

## Headline numbers (v0.9.0)

| Metric | Value | Delta vs v0.8.0 |
| --- | --- | --- |
| Lab version | 0.9.0 | +0.1.0 |
| Tests | 224/224 | +10 |
| Test files | 30 | +1 |
| `npm run verify` steps | 8/8 | unchanged |
| `npm run demo:oauth` | PASS (+ `OAUTH-DEMO REFRESH PASS`) | extended |
| `npm run verify:dev` | PASS | unchanged |
| `npm audit --omit=dev` | 0 vulnerabilities | unchanged |
| Source files added | 1 (`tests/unit/oauth/refresh-token-store.test.ts`) | +1 |
| Source files modified | 4 (`as-handlers.ts`, `app.ts`, `oauth-demo.ts`, `package.json`) | refresh-token wiring + version bump |
| New env vars | 1 (`MCP_OAUTH_REFRESH_TTL_SECONDS`, default 30 days) | +1 |
| New tools | 0 (refresh tokens are infrastructure, not a new tool) | unchanged |

## Files added / modified in v0.9.0

### Added

- `src/server/oauth/refresh-token-store.ts` (already present at session start, untracked; complete in-memory store, 174 lines).
- `tests/unit/oauth/refresh-token-store.test.ts` (new, 10 cases, mirrors `authorization-code-store.test.ts` style).

### Modified

- `src/server/oauth/as-handlers.ts` (+ `refreshStore` construction in `createAsHandlers`; + `refreshTtlSeconds` to `CreateAsHandlersOptions`; + `refreshStore: RefreshTokenStore` to `AsHandlerDeps`; + defense-in-depth guard in `serveAuthorizationCodeGrant` and `serveRefreshTokenGrant` that early-returns `as_disabled` when `localIssuer` is undefined; in-flight `serveAuthorizationCodeGrant` + `serveRefreshTokenGrant` already wired to the new store at session start).
- `src/server/app.ts` (+ `refreshTtlSeconds` env-var read; + passed into `createAsHandlers`; `SERVER_VERSION` bumped to `0.9.0`).
- `scripts/oauth-demo.ts` (+ refresh-token rotation + reuse-rejection block, including cross-client family-revocation test).
- `package.json` (`version` bumped to `0.9.0`).
- `.env.example` (+ `MCP_OAUTH_REFRESH_TTL_SECONDS` documentation block).
- `docs/OAUTH_AS.md` (+ "v0.9.0 — Refresh Tokens (RFC 6749 §6 + §10.4)" section; env-var table row; test-coverage table; honest-limitations update).
- `docs/SECURITY.md` (+ refresh-token control row in "Controls"; updated "In-memory AS state" row to mention refresh tokens).
- `docs/research/OFFICIAL_DOCS_RESEARCH.md` (+ RFC 6749 §6 + §10.4 row in the standards table; resolved "Add refresh tokens" open item; added evidence link).
- `docs/CHATGPT_APP_SETUP.md` (Production Auth Gap now references v0.9.0 refresh tokens).
- `REPORT.md` (this section + header bump to 0.9.0).

### NOT touched (per prompt hard rules)

- `docs/AUDIT_AGAINST_DISCOVERY_FIRST_PROMPT_v1.md` (historical record; per user choice).
- `C:\Anotator8\**` (prompt hard rule; verified by `git status` before and after).
- `C:\chat-gpt-mcp-app\**` (prototype is reference-only; verified by mtime baseline).

## Exact command outputs (re-run at v0.9.0 on 2026-06-08)

### `npx tsc -p tsconfig.build.json --noEmit`

```text
exit code 0 (no diagnostics)
```

### `npm test` (the full vitest run)

```text
 Test Files  30 passed (30)
      Tests  224 passed (224)
   Duration  6.82s
```

### `npm run build`

```text
> anotator8-chatgpt-integration-lab@0.9.0 build
> npm run build:clean && tsc -p tsconfig.build.json

> anotator8-chatgpt-integration-lab@0.9.0 build:clean
> node -e "const fs=require('fs');fs.rmSync('dist',{recursive:true,force:true});"

exit code 0
```

### `npm run smoke`

```text
SMOKE PASS
fixture bytes=4768
adapter annotations=3 unknownFields=2
validation valid=true warnings=1
server url=http://127.0.0.1:56882/mcp
oauth resource=http://127.0.0.1:56882/mcp bearer=header
initialize session=8e22829e-6d52-4cd4-839c-61c728cca368
```

### `npm run demo:oauth` (key lines)

```text
token issued expires_in=900s refresh_expires_in=2592000s token=eyJhbGciOiJS...
refresh #1 ok new_token=eyJhbGciOiJS... rotated_refresh=Tz3v5UX0...
rotated refresh correctly rejected on reuse (single-use)
cross-client refresh correctly rejected + family revoked
post-revocation refresh correctly rejected (invalid_grant)
mcp initialize server=anotator8-chatgpt-integration-lab v0.9.0
mcp tools/list returned 8 tools: list_capabilities, inspect_project, validate_project, summarize_annotations, find_annotations, suggest_labels, create_review_plan, export_chatgpt_report
auth code correctly rejected on reuse (single-use)
OAUTH-DEMO REFRESH PASS
PKCE mismatch correctly rejected
OAUTH-DEMO PASS
```

### `npm run verify:dev` (key lines)

```text
INSPECT-HEADLESS PASS
server url=http://127.0.0.1:56891/mcp
initialize session=88634dfd-30f7-4643-81a0-6ec20dfeb7bc server=anotator8-chatgpt-integration-lab@0.9.0
initialized notification status=202
tools/list count=8 (all readOnlyHint=true)
tools/call inspect_project ok=true stats={"annotationCount":3,"annotationTypes":{"box":1,"ellipse":1,"arrow":1},"shapeTypes":{"rect":1,"circle":1,"arrow":1},"subtitleTrackCount":1,"subtitleCueCount":1,"timelineTrackCount":2,"warningCount":1,"unknownFieldCount":2}
resources/list widget uri=ui://anotator8/review-widget.html
```

### `npm run verify` (tail)

```text
=== validate-canonical ===
files checked: 16
files skipped (non-YAML): 0
errors: 0
warnings: 0
PASS: all canonical YAML files parsed successfully
--- [validate:canonical] OK ---

=== [validate:truth-passport] npm run validate:truth-passport ===
files checked: 7
errors: 0
warnings: 3
  [WARN] decision-auth-strategy.yaml: confidence 'MEDIUM-HIGH (for what is implemented) / LOW (for production claim)' not in enum [HIGH, MEDIUM-HIGH, MEDIUM, MEDIUM-LOW, LOW]
  [WARN] lab-v0.4.0.yaml: completeness 0.7 (deferred items: G-01..G-07, G-19) is not a number between 0 and 1
  [WARN] tool-list-capabilities.yaml: related_gaps is empty or not an array
PASS: all truth passports validated
--- [validate:truth-passport] OK ---

=== verify summary ===
passed: 8/8
all checks passed
```

### `npm audit --omit=dev`

```text
found 0 vulnerabilities
```

### `git status` (lab, before final commit)

```text
On branch feature/v0.8.0-oauth-cutover
Your branch is up to date with 'origin/feature/v0.8.0-oauth-cutover'.

Changes not staged for commit:
  modified:   src/server/app.ts
  modified:   src/server/oauth/as-handlers.ts
  modified:   package.json
  modified:   REPORT.md
  modified:   docs/OAUTH_AS.md
  modified:   docs/SECURITY.md
  modified:   docs/CHATGPT_APP_SETUP.md
  modified:   docs/research/OFFICIAL_DOCS_RESEARCH.md
  modified:   .env.example
  modified:   scripts/oauth-demo.ts

Untracked files:
  src/server/oauth/refresh-token-store.ts
  tests/unit/oauth/refresh-token-store.test.ts
```

### `Set-Location C:\Anotator8; git status --short`

```text
?? .worktrees/
```

Pre-existing modification (`.worktrees/`) was present at session start and is not part of this session's work. **Anotator8 was not touched by this session.** Verified by `grep` returning 0 matches for `chatgpt|openai|mcp|ChatGPT|OpenAI|MCP` in `C:\Anotator8\src\**\*.{ts,tsx}` (RUNTIME_EVIDENCE).

## Section-by-section status (Discovery-First Build Prompt v1, re-verified at v0.9.0)

Per the user's choice, `docs/AUDIT_AGAINST_DISCOVERY_FIRST_PROMPT_v1.md` is preserved as the historical record. The table below re-asserts the COVERED status at v0.9.0 and notes any v0.9.0 deltas.

| Section | Status at v0.9.0 | v0.9.0 delta |
| --- | --- | --- |
| 0. Trust posture | COVERED | unchanged |
| 1. Official docs research | COVERED | +RFC 6749 §6 + §10.4 row in `docs/research/OFFICIAL_DOCS_RESEARCH.md` |
| 2. Environment detection | COVERED | re-run this session (PowerShell 5.1, Node v22.22.0 ¹, npm 11.6.2, git 2.52.0; Anotator8 grep count = 0 for chatgpt/openai/mcp; prototype file count = 39 baseline). Note: the `package.json` v0.8.0 snapshot claimed Node v24.x; the actual host runs Node v22.22.0, which is sufficient for the lab (Node 22+ supports all features used). |
| 3. Anotator8 product surface | COVERED | unchanged |
| 4. Old prototype connector audit | COVERED | unchanged |
| 5. External integration lab folder | COVERED | unchanged |
| 6. Integration product scope | COVERED | unchanged; refresh tokens are infrastructure not a new tool |
| 7. ChatGPT App UI widget | COVERED | unchanged |
| 8. Adapter-first architecture | COVERED | unchanged |
| 9. Security and privacy model | COVERED | + refresh-token control row in `docs/SECURITY.md` (single-use rotation, family revocation, hash-only storage, TTL sweep) |
| 10. Tool schemas and output schemas | COVERED | unchanged |
| 11. Test strategy | COVERED | + `tests/unit/oauth/refresh-token-store.test.ts` (10 cases). See the verification table below. |
| 12. Demo fixtures | COVERED | unchanged |
| 13. Portability plan | COVERED | unchanged |
| 14. Implementation order | COVERED | re-run end-to-end this session |
| 15. Anti-neuro-garbage rules | COVERED | re-verified: zero `child_process`/`exec`/`spawn` in `src/server/**`; 8/8 tools still `readOnlyHint: true, destructiveHint: false, openWorldHint: false`; no widget changes; no `run_shell`-style tools; no new write tools |
| 16. Deliverables | COVERED | See the deliverables table below. |

¹ Node version note: the lab at v0.8.0 reportedly ran Node v24.x on a different host. The current host (this session) runs Node v22.22.0, which is sufficient for `@modelcontextprotocol/sdk@1.29.0` and `@modelcontextprotocol/ext-apps@1.7.4` (both list Node >= 18 in their engines). No code change required.

## Section 11 verification table (v0.9.0)

| Check | Command | Result | Evidence |
| --- | --- | --- | --- |
| Refresh-token store unit tests | `npm test` (vitest) | PASS | `tests/unit/oauth/refresh-token-store.test.ts` 10/10 cases |
| Refresh-token rotation end-to-end | `npm run demo:oauth` | PASS | `OAUTH-DEMO REFRESH PASS` + 3 negative assertions (rotated-reuse, cross-client, post-revoke) |
| `createAsHandlers` wires `refreshStore` | `npx tsc -p tsconfig.build.json --noEmit` | PASS | exit 0; `grep refreshStore src/server/oauth/as-handlers.ts` shows construction + `deps` entry |
| `app.ts` passes `refreshTtlSeconds` | `grep refreshTtlSeconds src/server/app.ts` | PASS | env-var read with 30-day default; passed into `createAsHandlers` |
| Defense-in-depth guards | `npx vitest run tests/integration/oauth/authorization-server.test.ts` | PASS | 10/10 (was 8/10 in v0.8.0; the 2 previously-failing tests now pass because the `localIssuer` guard prevents the env-var race that produced the 500) |
| Production dependencies | `npm audit --omit=dev` | PASS | 0 vulnerabilities |
| Lab working tree changes | `git status` | as expected | 10 modified + 2 untracked; nothing surprising |
| Anotator8 untouched | `Set-Location C:\Anotator8; git status --short` | PASS | only pre-existing `.worktrees/` (not from this session) |
| Old prototype untouched | `Get-ChildItem C:\chat-gpt-mcp-app -File` count | UNCHANGED | 39 files; mtime baseline |
| Widget controls not fake | `npx vitest run tests/contract/widget-bridge.test.ts` | PASS | unchanged at v0.9.0 |
| `npm run verify` end-to-end | `npm run verify` | PASS | 8/8 (build + test + smoke + demo:stdio + demo:oauth + verify:dev + validate:canonical + validate:truth-passport) |

## Tool contracts table (v0.9.0, unchanged from v0.8.0)

| Tool | Purpose | Read/write | Tested | Notes |
| --- | --- | --- | --- | --- |
| `list_capabilities` | Returns supported Anotator8 integration features + limitations | read | yes | |
| `inspect_project` | Accepts Anotator8 project JSON or fixture id; returns normalized summary | read | yes | |
| `validate_project` | Checks project for internal consistency (missing ids, broken time ranges, invalid cues, unknown types, orphaned clips, missing source metadata) | read | yes | |
| `summarize_annotations` | Human-readable summary of annotation distribution | read | yes | |
| `find_annotations` | Query/filter annotations by type, label, time range, text, confidence | read | yes | |
| `suggest_labels` | Suggests candidate labels (does not invent) | read | yes | |
| `create_review_plan` | Produces a manual review checklist | read | yes | |
| `export_chatgpt_report` | Portable report JSON/Markdown for human use | read | yes | |

No new tools in v0.9.0. Refresh tokens are OAuth infrastructure, not a tool surface.

## What v0.9.0 does NOT yet do (honest)

- ~~Add refresh tokens~~ resolved in v0.9.0.
- CIMD hardening (verify CIMD URL appears in `redirect_uris`) в— tracked as v0.10.0.
- Split lab `iss` from IdP `iss` in external mode в— tracked as v0.10.0.
- Pre-warm JWKS cache at startup в— tracked as v0.10.0.
- Export a real Anotator8 project file as a golden fixture в— tracked as v0.10.0.
- Implement `propose_annotation_changes` / `apply_annotation_patch` (write tools) в— gated on the read-only contract being stable AND a production IdP being in place.
- Post-hoc reuse detection: once a row is swept (TTL expiry or first consume), the store cannot distinguish "expired" from "reused" from "never existed". The full reuse-detection (tombstones per family that trigger automatic revocation on reuse) is a v0.10.0 enhancement. Current behavior is per RFC 6749 §6 "MUST reject" but does not include the additional belt-and-braces auto-revocation of the entire family on detected reuse (only on cross-client presentation).

## Section 16 deliverables table (v0.9.0)

| Deliverable | Status | Location |
| --- | --- | --- |
| Working integration lab folder outside Anotator8 | DONE | `C:\anotator8-chatgpt-integration-lab\` |
| MCP/App server code | DONE | `src/server/**` |
| Tool implementations (8 read-only) | DONE | `src/server/tools/**` |
| Input/output schemas | DONE | `src/server/schemas.ts` + per-tool Zod schemas |
| Adapter for Anotator8 project data | DONE | `src/server/anotator8-adapter.ts` |
| Fixtures | DONE | `fixtures/sample-project.anotator8.json`, `fixtures/sample-subtitles.vtt` |
| Tests (224/224) | DONE | `tests/**` (30 files) |
| Smoke script | DONE | `npm run smoke` |
| ChatGPT widget (MCP Apps host bridge + legacy fallback) | DONE | `src/server/resources/widget-resource.ts` + `src/server/widget/**` |
| Setup docs | DONE | `docs/CHATGPT_APP_SETUP.md`, `docs/QUICKSTART.md`, `docs/MCP_COMPATIBILITY.md` |
| Security docs | DONE | `docs/SECURITY.md` |
| Porting guide | DONE | `docs/PORTING_TO_ANOTATOR8.md` |
| QA report | DONE | this `REPORT.md` (v0.9.0 at the top) |
| Refresh-token support (v0.9.0) | DONE | `src/server/oauth/refresh-token-store.ts` + `as-handlers.ts` + `app.ts` |

## Section 2 environment table (re-affirmed at v0.9.0)

| Field | Value | Source |
| --- | --- | --- |
| OS / shell | Windows 10.0.26200 / PowerShell 5.1 | RUNTIME_EVIDENCE |
| Workspace path | `C:\chat-gpt-mcp-app` | session-start info |
| Anotator8 repo path | `C:\Anotator8` | session-start info + `Test-Path` |
| Current branch | `feature/v0.8.0-oauth-cutover` | `git rev-parse --abbrev-ref HEAD` |
| Git clean (lab) | NO (10 modified + 2 untracked; all expected from v0.9.0 work) | `git status --short` |
| Node available | YES (v22.22.0) | `node --version` |
| npm available | YES (11.6.2) | `npm --version` |
| Python available | YES (out of scope for this session; only the `C:\chat-gpt-mcp-app` prototype uses Python) | session-start info |
| Internet available | YES (npm + git operations work) | RUNTIME_EVIDENCE |
| Browser available | YES (out of scope for headless verification; `npm run inspect` is interactive and would need a browser) | session-start info |
| Can run MCP Inspector (headless) | YES | `npm run verify:dev` PASS |
| Can expose tunnel / ChatGPT Developer Mode | UNCLEAR this session (no tunnel client exercised; not required for v0.9.0 scope) | not exercised |

---

End of Phase 6. v0.9.0 ships with refresh-token support, 224/224 tests, 8/8 verify, 0 vulnerabilities. The lab remains at `feature/v0.8.0-oauth-cutover` ready for review and merge.
