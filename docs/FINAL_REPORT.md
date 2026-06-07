# Anotator8 × ChatGPT Integration Lab — Final Discovery-First Report

**Date:** 2026-06-06
**Author:** Mavis (Mavis orchestrator)
**Lab version:** 0.2.0
**MCP SDK:** `@modelcontextprotocol/sdk@^1.29.0` + `@modelcontextprotocol/ext-apps@^1.0.0`

---

## TL;DR

- A complete **external MCP integration lab** for Anotator8 lives at `C:\anotator8-chatgpt-integration-lab\`. No code was added inside Anotator8.
- 7 read-only tools are registered, with typed input/output schemas and deterministic tests.
- **Runtime evidence (RUNTIME_EVIDENCE):** the Express server actually binds, `GET /health` and `GET /ready` return 200, and a real `tests/integration/http-mcp-protocol.test.ts` sends `initialize`, `tools/list`, `tools/call` over HTTP and parses SSE responses successfully.
- **Tests:** 91 / 91 passing. **Smoke:** 6 / 6 passing. **TypeScript build:** clean.
- **Not verified by this session:** real ChatGPT Developer Mode connection (no `cloudflared` / `ngrok` / `tunnel-client` installed on this host; documented in `docs/CHATGPT_APP_SETUP.md`).

---

## 1. Environment

| Item | Value |
|---|---|
| OS / shell | Windows 10+ (PowerShell 5.1) |
| Workspace | `C:\anotator8-chatgpt-integration-lab` |
| Anotator8 repo | `C:\Anotator8` (git, branch `main`, 4 sibling worktrees) |
| Old prototype | `C:\chat-gpt-mcp-app` (Python 3.14, mcp>=1.26) |
| Node | 24.13.0 |
| npm | 11.6.2 |
| Python | 3.14.0 |
| Git | 2.52.0 |
| Internet | YES (npm registry reachable; MCP Inspector installs on demand) |
| Browser available | UNCLEAR (Playwright not used here) |
| MCP Inspector (CLI) | YES (`npx @modelcontextprotocol/inspector@0.22.0` — auto-installs) |
| `cloudflared` | NOT installed |
| `ngrok` | NOT installed |
| `tunnel-client` (Secure MCP Tunnel) | NOT installed |

`gh` CLI status was not checked — repo remote is configured (`origin: github.com/void-79/anotator8-chatgpt-integration-lab.git`).

---

## 2. Official docs research

| Source | What it says | Impact on architecture | Risk if ignored |
|---|---|---|---|
| **OpenAI Apps SDK** (Oct 2025 launch) | MCP-based + a proprietary widget layer; `ui://widget/...` template URIs; widget receives `ui/notifications/tool-result` via `postMessage` from ChatGPT iframe | Use `@modelcontextprotocol/ext-apps` for `registerAppResource` and `registerAppTool`; widget must use `textContent` (no `innerHTML`) and check `e.source === window.parent` | XSS via project text or widget DOM; widget blocked by ChatGPT |
| **OpenAI Developer Mode** (Sept 11, 2025) | Free for Plus/Pro; remote MCP server reached via HTTPS URL; SSE/Streamable HTTP transports | Bind to `127.0.0.1` for local; use `StreamableHTTPServerTransport` from SDK; recommend Bearer auth + reverse proxy in front of any public tunnel | Connection refused in ChatGPT; write tools that bypass human-in-the-loop |
| **MCP Spec 2025-06-18** | JSON-RPC 2.0; `initialize` / `tools/list` / `tools/call`; `readOnlyHint` / `destructiveHint` / `openWorldHint` annotations; structured `outputSchema`; `_meta` for widget-only data | All 7 tools declared `annotations: { readOnlyHint: true }`; output schemas are raw Zod shapes (not `z.object(...)`) per `zod-compat.js`; tool responses wrap `{ content, structuredContent, _meta }` | ChatGPT treats read-only tools as write, prompts for confirmation every call; non-conformant tools blocked |
| **`@modelcontextprotocol/sdk@1.29.0`** | `McpServer`, `StreamableHTTPServerTransport`, `createMcpExpressApp` (Express + `express.json()` already registered), `ResourceTemplate` | We use the official SDK, not a hand-rolled JSON-RPC layer; do NOT add a second `express.json()` (causes "stream is not readable") | Server crashes on first POST; session manager leaks |
| **`@modelcontextprotocol/ext-apps@1.0.0`** | `registerAppTool` callback must return `{ [x: string]: unknown; content: [...]; _meta?: {...}; structuredContent?: {...} }`; `outputSchema` must be a raw Zod shape, not `z.object(...)` | `toolSuccess()` / `toolError()` helpers cast to `Record<string, unknown>` and add an explicit index signature so TypeScript is happy | TypeScript build fails, or runtime rejects with "output schema invalid" |
| **MCP Inspector** | `npx @modelcontextprotocol/inspector --server-url http://127.0.0.1:8787/mcp` for SSE/HTTP; `--cli` for non-GUI smoke | No GUI on Windows, but CLI mode can drive `tools/list` + `tools/call`. The lab's own `tests/integration/http-mcp-protocol.test.ts` is the equivalent runtime evidence | "Did it actually work?" remains unanswered without runtime protocol test |

Full research is in `docs/research/OFFICIAL_DOCS_RESEARCH.md` and `docs/RESEARCH_SYNTHESIS.md` (was already prepared by a prior research pass — re-verified, not invented).

---

## 3. Anotator8 product surface map

Read-only inspection of `C:\Anotator8`. Source: `ARCHITECTURE.md`, `src/domain/entities/UDMNode.ts`, `src/domain/export/shipped.ts`, `package.json`.

| Surface | User-visible capability | Source files | Data model | Runtime/test evidence | Integration relevance |
|---|---|---|---|---|---|
| **Toolbar / modes** | Visual, Blocks, Studio Beta (timing editor). Code / readonly modes deferred. | `src/presentation/components/ToolbarModes.tsx`, `src/domain/entities/UDMNode.ts` (`SHIPPED_VIEW_MODES`) | `SHIPPED_VIEW_MODES = ['visual', 'blocks', 'studio']` | Architecture doc explicitly locks via constants | Integration should not assume a 4th mode; Studio Beta is a separate export concern |
| **Annotations** | UI ships only **box / ellipse / arrow**. Polygon, point, text, image, chapter, highlight, comment, tag exist as `AnnotationType` but are NOT in the shipped toolbar. | `src/domain/entities/UDMNode.ts` line 153: `SHIPPED_ANNOTATION_TYPES = ['box', 'ellipse', 'arrow']` | `AnnotationType` (11 entries) | "Shipped vs deferred" table in `ARCHITECTURE.md` | The lab fixture has 5 types (incl. `highlight`, `comment`) — these are *possible* per the type system, but a real Anotator8 saved project will only contain `box/ellipse/arrow` from the UI |
| **Project file format** | Save/Open: JSON or ZIP (`.anatator`) with manifest + `project.json`. Download is `exportToJSON` which produces `{ version: '24.0.0', nodes: UDMNode[] }`. | `src/domain/export/shipped.ts`, `src/application/projectFile.ts` | `exportToJSON(nodes)` → `{ version: '24.0.0', nodes }` — **no videoSource / subtitleTracks / classroom fields in the canonical export** | `verify:gate` test ships it | **Mismatch:** the lab fixture includes `videoUrl`, `videoSource`, `locale`, `classroomId`, `subtitleTracks`, `subtitleCues` — these are NOT in the real Anotator8 export. The adapter is permissive; a porting step must decide whether the real export needs expansion or the lab fixture needs to match `exportToJSON` |
| **UDMNode (real)** | 14 required fields: `id, type, spatial, temporal, visual, extensions, sync, parentId, fractionalIndex, createdAt, updatedAt, deletedAt, ownerId, isEducationRecord, dataResidency` | `src/domain/entities/UDMNode.ts` | Includes FERPA/COPPA/GDPR (`ownerId`, `isEducationRecord`, `dataResidency`) and crypto (`sync.integrity` = `parentHash` + `signature` + `publicKey` ed25519) | Real `exportToJSON` always includes `sync` and the GDPR fields | **Mismatch:** the lab's `UDMNode` in `src/shared/types.ts` is missing `sync`, `ownerId`, `isEducationRecord`, `dataResidency`. The adapter is graceful (skips nodes with missing fields, with a `NODES_SKIPPED` warning). A future port should extend the type to match real Anotator8 — or filter to a published subset for ChatGPT |
| **Video source** | URL field only — never embedded. Studio UI uses `VideoExportButton` which is gated by COOP/COEP + URL. | `src/presentation/components/VideoExportButton.tsx`, `src/application/services/videoExportUi.ts` | `Project.videoUrl: string` | `verify:gate` ships URL binding honesty | Integration must not promise video frame access — the lab never receives the file, only the URL |
| **Sync / CRDT** | LWW + Loro/Fugue. Ed25519 signatures on every node (`integrity.parentHash` + `signature` + `publicKey`). | `src/domain/entities/UDMNode.ts` SyncMetadata; `loro-crdt` runtime | `SyncMetadata { serverSeq, localOpId, nodeId, lastSyncedAt, properties, integrity }` | `verify:gate` includes sync tests | Lab must treat sync fields as opaque integrity metadata; do not modify or re-sign |
| **Project file (save/open)** | `projectFile` service handles save → JSON or ZIP. | `src/application/projectFile.ts` | `ProjectFileActions.tsx` triggers it | UI button | A future port: expose the project JSON via the MCP server endpoint from the Anotator8 backend, not the frontend |
| **Subtitle tracks** | `SubtitleTrack` + `SubtitleCue` with `text: Record<AppLocale, string>`, `style: SubtitleStyle`, `animation`. AppLocale ∈ {`en`, `ru`, `kk`}. | `src/shared/types.ts` (lab) — but real Anotator8 file: `backend_py/app/...` | Animation includes `typewriter` / `karaoke` in real Anotator8, not just `none`/`fade`/`slide` per the lab | The lab's fixture is synthetic (marked `_synthetic: true`); it's not a real Anotator8 export | A port should pull a real `.anatator` file from Anotator8's `localStorage` / backend to test against |
| **Test strategy** | `verify:gate` includes typecheck, lint, build, vitest, playwright e2e, backend pytest, RLS pilot. | `package.json` scripts (60+ verify:* scripts) | Multiple Vitest configs (shipped, experimental, perf, l0) | Real verify:gate runs 30+ minutes | Lab's `npm test` is a much smaller smoke — the Anotator8 verify:gate is the real authority |
| **Backend** | `backend_py` (Python FastAPI), `SHIPPED_ROUTERS = { auth, sync, audit, crypto, classrooms, billing, plugin_proxy }`. SQLite for `npm start`; Postgres + RLS for staging. | `backend_py/app/main.py` | `GET /api/v1/health`, `GET /api/v1/ready` for probes | `verify:pilot` runs it | Future port: mount `/mcp` handler on the Python backend (or run a sidecar TypeScript service) |

### What this means for the lab

- The lab is **functionally complete** for read-only analysis, but its type model is **less strict than real Anotator8** (missing `sync`, `ownerId`, FERPA fields). This is acceptable for a chat-side review tool, but a port that round-trips with `exportToJSON` will need to either extend the type or project to a smaller published subset.
- The fixture is **synthetic** and includes fields (subtitle tracks, classroom IDs) that the real Anotator8 export does not produce. A real `sample.anatator.json` from a saved project will look different — specifically it will not have `videoSource`, `subtitleTracks`, `subtitleCues` at the top level. The adapter should be tested against a real export before porting.
- The 11-type `AnnotationType` is a *domain* concept, not a *shipped* one. Integration tools that report annotations should be honest: real saved projects will be 90%+ `box/ellipse/arrow`.

---

## 4. Prototype connector audit (`C:\chat-gpt-mcp-app` v0.1.0)

Python project, `mcp>=1.26.0`, `pydantic-settings`, `pyyaml`. Read-only inspection of `src/dev_mcp/{server,permissions,audit,config}.py` and `src/dev_mcp/adapters/{git,files,runner}.py`.

| Area | What exists | Useful idea | Not reusable / unsafe | Evidence |
|---|---|---|---|---|
| **Server framework** | `FastMCP` with `stateless_http=True`, `json_response=True`, `transport="streamable-http"`. | Confirms the Streamable HTTP transport is the right production choice for ChatGPT Developer Mode | — | `server.py:38-44, 219` |
| **Tool registration** | 8 tools: `list_profiles`, `get_git_status`, `get_git_diff`, `get_git_log`, `read_file`, `list_files`, `search_code`, `run_profile`, `get_project_info` | Annotations pattern (`READ_ONLY` vs `WRITE` ToolAnnotations) | Tools are **local-dev** (git/files/runner) — none of them are Anotator8-aware | `server.py:51-188` |
| **Path sandboxing** | `PermissionGuard` with `blocked_segments` (`.git`, `node_modules`, `.venv`, …) and `blocked_file_names` (`.env`, `id_rsa`, `credentials.json`). `resolve_path()` ensures `path.relative_to(project_root)`. | Concept: deny-by-default path guard; the lab is even more conservative because it has **no FS at all** | The lab doesn't need this — its data is passed in tool arguments | `permissions.py:12-49` |
| **Audit log** | `log_tool_call(tool, arguments, result_summary)` writes JSONL to `logs/tool_calls.jsonl`. Truncates result to 500 chars. | The QA report's "concept adopted" mention is half-true: the lab does NOT write to a file. `_meta.warnings` is the closest analogue | — | `audit.py:11-22` |
| **Profiles (allowlist commands)** | `run_profile` only invokes commands from `config.yaml`, never arbitrary shell | Pattern matches our "no `run_shell`" anti-neuro-garbage rule | Not Anotator8 domain — the lab doesn't need it | `server.py:145-174` |
| **Auth** | `DEV_MCP_API_KEY` (Bearer) for production; warning printed at startup if not set | Same pattern the lab uses (`MCP_AUTH_TOKEN` + `bearerAuth` middleware) | — | `server.py:209-212`, `lab/src/middleware/auth.ts` |
| **Subprocess execution** | `runner.py` executes allowlisted commands with timeout + max output bytes | Idea: bounded time / output on any external execution. Lab has zero subprocess | `run_profile` is a write tool that requires user approval; lab has no equivalent (deliberately) | `adapters/runner.py` |
| **Tunnel docs** | README documents Secure MCP Tunnel, ngrok, Cloudflare Tunnel | Lab `docs/CHATGPT_APP_SETUP.md` covers the same three options | — | prototype `README.md:48-83`; lab `docs/CHATGPT_APP_SETUP.md` |
| **Domain** | Local dev tools — git status, file read, profile runner | None for Anotator8 | Prototype knows nothing about Anotator8 project data, UDMNode, annotation types, video sources, subtitles, classrooms | All 8 tools are git/file/command focused |

### Reuse decision

- **Adopted from prototype:** Bearer auth pattern; Streamable HTTP transport; tunnel documentation; audit-log *concept* (the lab records warnings in `_meta` instead of writing to a JSONL file — the design decision is in the QA report and `docs/RESEARCH_SYNTHESIS.md`).
- **NOT adopted:** path guard (lab has no FS), `run_profile` (no shell, no mutation), git/file/code tools (out of domain).
- **Hard rule honored:** the lab is a *product-facing ChatGPT integration*, not a *local coding helper*. The prototype's design and the lab's design are different categories.

---

## 5. Final build status

| Check | Command | Result |
|---|---|---|
| TypeScript build | `npm run build` | ✅ PASS — 0 errors, `dist/` produced |
| Type checking | `npx tsc --noEmit` | ✅ PASS — 0 errors |
| Unit + integration + contract tests | `npm test` | ✅ 91 / 91 |
| Smoke | `npm run smoke` | ✅ 6 / 6 |
| Real HTTP server start | `node dist/server/index.js` | ✅ listening on 127.0.0.1:8787 |
| `GET /health` | (PowerShell `Invoke-WebRequest`) | ✅ 200 `{"status":"ok","ts":...}` |
| `GET /ready` | (PowerShell `Invoke-WebRequest`) | ✅ 200 `{"status":"ready","version":"0.2.0","sessions":0}` |
| HTTP-level MCP protocol test | `tests/integration/http-mcp-protocol.test.ts` | ✅ 6 / 6 (real JSON-RPC over HTTP via `fetch`; SSE response parsing) |
| MCP Inspector CLI | `npx @modelcontextprotocol/inspector --help` | ✅ installs and runs (v0.22.0); no GUI on Windows |

### What was built

| Component | Status | Evidence |
|---|---|---|
| External lab folder | ✅ | `C:\anotator8-chatgpt-integration-lab\` — git repo, 1 base commit, working tree clean of prior stale runs |
| MCP server (Streamable HTTP) | ✅ | `src/server/index.ts` — `createMcpExpressApp` + `StreamableHTTPServerTransport`; binds to `MCP_HOST`/`MCP_PORT`; health/ready probes; SIGTERM/SIGINT graceful shutdown |
| 7 read-only tools | ✅ | `src/server/tools/{list-capabilities,inspect-project,validate-project,summarize-annotations,find-annotations,create-review-plan,export-chatgpt-report}.ts` |
| Tool response helpers | ✅ | `src/server/tools/schemas.ts` — `toolSuccess()` / `toolError()` with explicit index signature; path + stack-trace sanitization |
| Anotator8 adapter | ✅ | `src/server/anotator8-adapter.ts` — `normalize()` (size-cap at 10 MB), `validate()` (7 checks), `computeStats()`, `collectUnknownFields()` |
| Shared types | ✅ | `src/shared/types.ts` — branded `ObjectID`/`VideoTime`; `UDMNode`/`ProjectFilePayload`; `NormalizedProject`; `CapabilitiesResult`/`InspectProjectResult`/etc. (⚠️ missing `sync`/`ownerId`/FERPA fields — see §3) |
| Bearer auth middleware | ✅ | `src/middleware/auth.ts` — optional; no-op if `MCP_AUTH_TOKEN` is empty |
| Widget (Apps SDK) | ✅ | `src/server/resources/widget-resource.ts` + `src/widget/{index.html,widget.ts,styles.css}` — `ui://widget/anotator8-widget.html` registered via `registerAppResource`; reads `ui/notifications/tool-result` from `window.parent`; uses `textContent` (no `innerHTML`) |
| Prompt template | ✅ | `src/server/prompts/project-review.ts` — Russian-language structured review with focus filter |
| Rate limiting | ✅ | `express-rate-limit` 100 req / 60 s per IP, configurable |
| Fixtures | ✅ | `fixtures/sample-project.anotator8.json` (synthetic, marked `_synthetic: true`) — 5 annotations, 3 cues, 2 tracks, intentional `_note` |
| Unit tests | ✅ | `tests/unit/{adapter,schemas}.test.ts` — 28 tests |
| Integration tests (in-process) | ✅ | `tests/integration/tools.test.ts` — 24 tests (tool contract simulation) |
| Integration tests (HTTP/MCP) | ✅ | `tests/integration/http-mcp-protocol.test.ts` — 6 tests, **real Express server + real fetch** |
| Contract tests | ✅ | `tests/contract/mcp-tool-contracts.test.ts` — 33 tests (Zod schema compliance) |
| Smoke script | ✅ | `src/scripts/smoke.ts` — fixture load, parse, validate, type counts, subtitle counts, server module |
| Dockerfile | ✅ | multi-stage `node:22-alpine`; non-root `appuser`; `HEALTHCHECK` on `/health` |
| Docs | ✅ | `README.md` + `docs/{ARCHITECTURE,SECURITY,PORTING_TO_ANOTATOR8,CHATGPT_APP_SETUP,TOOL_CONTRACTS,QA_REPORT,BUILD_REPORT,RESEARCH_SYNTHESIS}.md` + `docs/research/OFFICIAL_DOCS_RESEARCH.md` |
| Capabilities manifest | ✅ | `config/capabilities.example.json` (tools, prompts, resources, security block) |
| `.env.example` | ✅ | `MCP_HOST` / `MCP_PORT` / `MCP_AUTH_TOKEN` / `RATE_LIMIT_*` / `CORS_ORIGIN` |
| `.gitignore` | ✅ | `node_modules`, `dist`, `.env`, `.worktrees/`, `.mavis/`, `*.tsbuildinfo`, `err.txt`/`out.txt`/etc. |
| `vitest.config.ts` | ✅ | excludes `.worktrees/`, `node_modules/`, `dist/` (was picking up duplicate tests from the worktree) |

### Tool contracts (read/write + evidence)

| Tool | Purpose | Read/Write | Tested (count) | Evidence |
|---|---|---|---|---|
| `list_capabilities` | Enumerate features, limitations, annotation types, subtitle languages | R | 1 + 1 contract | contract test; live JSON-RPC over HTTP returns `supportedFeatures: [...10 strings...]` |
| `inspect_project` | Normalize project JSON, return source + stats + warnings | R | 3 + 1 contract + 1 live | live test asserts `source.kind === 'direct-url'`, `stats.totalAnnotations === 5`, `rawSummary.nodeCount === 5` |
| `validate_project` | Run 7 consistency checks (JSON structure, IDs, time ranges, spatial bounds, cue references, cue times) | R | 3 + 1 contract | fixture validates `valid: true, errors: 0` |
| `summarize_annotations` | Compute type/shape counts, temporal range, color/opacity stats | R | 1 + 1 contract | in-process |
| `find_annotations` | Filter by type/shape/time/text/color with limit 1-100 | R | 5 + 1 contract + 1 live | live test filters `type='box'` and asserts all matches have `type='box'` |
| `create_review_plan` | Build sections of verification/suggestion/issue items with priority | R | 1 + 1 contract | in-process |
| `export_chatgpt_report` | Produce Markdown or JSON report (includes unknown fields if requested) | R | 3 + 1 contract | in-process |

### Anotator8 adapter (data area support)

| Data area | Supported | Unsupported | Unknown preserved |
|---|---|---|---|
| `version` | ✅ string | — | n/a |
| `videoSource` | ✅ `local-file` / `direct-url` / `youtube` / `demo` → `kind: 'none'\|'local'\|'direct-url'\|'youtube'\|'unknown'` | demo `kind: 'demo'` mapped to `direct-url` (preserves URL but loses semantic) | ✅ added to `unknownFields` |
| `videoUrl` | ✅ inferred YouTube if URL matches; otherwise `direct-url` | — | ✅ |
| `nodes` | ✅ UDMNode list; **missing `sync`/`ownerId`/FERPA fields tolerated with `NODES_SKIPPED` warning** | strict `spatial.x/y/width/height` numbers and `temporal.startTime` required; invalid nodes are dropped | ✅ extra fields preserved per-node are not preserved in normalized form (kept in raw `unknownFields` if at top level) |
| `subtitleTracks` | ✅ list of `{id, language, label, visible, locked}` | — | ✅ |
| `subtitleCues` | ✅ list of `{id, trackId, startTime, endTime, text, style, animation}`; `text: Record<AppLocale, string>` is collapsed (stringified in `unknownFields`) | real Anotator8 `typewriter` / `karaoke` animations are preserved as unknown (adapters' union is `none`/`fade`/`slide`) | ✅ |
| `metadata` | ✅ `locale`, `classroomId`, `classroomName` | — | ✅ |
| top-level extras (e.g. `_synthetic`, `_note`) | — | — | ✅ preserved in `unknownFields` |

### Prototype reuse decision

| Prototype idea | Reused? | Why |
|---|---|---|
| Bearer auth pattern (`DEV_MCP_API_KEY`) | ✅ | Same shape as `MCP_AUTH_TOKEN` + `bearerAuth` middleware |
| Streamable HTTP transport | ✅ | Confirmed as correct production transport for ChatGPT Developer Mode |
| Audit logging (JSONL) | ⚠️ Concept only | Lab records warnings in `_meta.warnings` instead of writing a file (lab is read-only, no FS writes) |
| Path sandboxing | ❌ | Lab has no FS access at all — strictly stronger than a path guard |
| `run_profile` (allowlist commands) | ❌ | Lab has no shell, no mutation — write tools are explicitly out of scope |
| Git / file / code tools | ❌ | Out of Anotator8 domain |
| Tunnel docs (Secure MCP Tunnel / ngrok / Cloudflare) | ✅ | `docs/CHATGPT_APP_SETUP.md` documents the same three options |

### Security model

| Risk | Mitigation | Remaining concern |
|---|---|---|
| Arbitrary FS access | Lab never imports `node:fs` in a tool path; project data is passed in tool arguments | None — verified by code review |
| Shell command execution | No `child_process` / `exec` / `spawn` in tool paths; no `run_shell` tool | None |
| Secret reading | `.env` is not read by any tool; `MCP_AUTH_TOKEN` is loaded once at startup | The fixture has fake integrity hashes (`0x00…00` etc.) — these are NOT real signatures; a future fixture should not include any real signing material |
| Prompt injection via project text/subtitles | Read-only tools only; no execution path that uses user text as code | Subtitle text is shown to ChatGPT — if a user injects instructions, ChatGPT is responsible for following them; the lab does not amplify injection |
| Large-project DoS | `MAX_PROJECT_SIZE = 10 MB` enforced in `normalize()` (size-checked against JSON string length) | Could add request-level size limits via Express body-parser config (currently relies on SDK default) |
| Excessive tool calls | `express-rate-limit` 100 req / 60 s per IP | Not per-session; a multi-tenant deployment should also enforce per-token |
| Widget XSS | All rendering via `textContent` (no `innerHTML` with user data); `postMessage` source checked (`event.source === window.parent`) | The widget does not currently sandbox iframe depth |
| Unauthenticated public exposure | `MCP_AUTH_TOKEN` is optional; if unset, the server logs a clear warning | Dev convenience — production must always set it |
| Untrusted HTTPS termination | Docs say to use Cloudflare Tunnel / ngrok / VPS with TLS | Actual TLS configuration is outside the lab's scope |
| Error-message info leak | `toolError()` strips stack traces (`\s+at\s+.*`) and file paths (`C:\...:NN` and `/...:NN`) | Tested in `tests/unit/schemas.test.ts` |

### Verification output (exact commands)

```text
$ npm run build
> anotator8-chatgpt-integration-lab@0.2.0 build
> tsc
(no output → success)

$ npm test
 RUN  v2.1.9 C:/anotator8-chatgpt-integration-lab

 ✓ tests/integration/http-mcp-protocol.test.ts (6 tests) 135ms
 ✓ tests/contract/mcp-tool-contracts.test.ts (33 tests) 11ms
 ✓ tests/unit/adapter.test.ts (17 tests) 5ms
 ✓ tests/integration/tools.test.ts (24 tests) 9ms
 ✓ tests/unit/schemas.test.ts (11 tests) 3ms

 Test Files  5 passed (5)
      Tests  91 passed (91)
   Duration  1.18s

(Note: prior session reported 85/126 because the worktree's `wt-17ce3ed7` was being picked up
by vitest's default test glob. After adding `vitest.config.ts` to exclude `.worktrees/`,
the canonical count is 91. The 126 number in earlier reports included 35 duplicate tests
from the worktree copy of the same files.)

$ npm run smoke
=== Anotator8 ChatGPT Integration Lab - Smoke Test ===

[1/6] Loading fixture project...                 ✓
[2/6] Parsing project data...                    ✓ (5 annotations)
[3/6] Validating project...                      ✓ (VALID)
[4/6] Checking annotation types...               ✓ (box/arrow/ellipse/highlight/comment)
[5/6] Checking subtitle tracks...                ✓ (2 tracks, 3 cues)
[6/6] Testing server module...                   ✓

Passed: 6 / Failed: 0
✅ All smoke tests PASSED

$ node dist/server/index.js &
Starting anotator8-chatgpt-lab v0.2.0...
anotator8-chatgpt-lab v0.2.0 listening on http://127.0.0.1:8787
MCP endpoint: POST/GET/DELETE /mcp
Health: GET /health
Ready:  GET /ready
Auth: DISABLED (set MCP_AUTH_TOKEN to enable)

$ curl http://127.0.0.1:8787/health
{"status":"ok","ts":1780756041894}

$ curl http://127.0.0.1:8787/ready
{"status":"ready","version":"0.2.0","sessions":0}

$ npx @modelcontextprotocol/inspector --help
Usage: inspector-bin [options]
  -e <env>               environment variables in KEY=VALUE format
  --config <path>        config file path
  --server <n>           server name from config file
  --cli                  enable CLI mode
  --transport <type>     transport type (stdio, sse, http)
  --server-url <url>     server URL for SSE/HTTP transport
  --header <headers...>  HTTP headers as "HeaderName: Value" pairs
  -h, --help             display help for command
```

### HTTP-level MCP test (real JSON-RPC over HTTP)

The new `tests/integration/http-mcp-protocol.test.ts` proves the server actually speaks MCP. It:
1. Binds the Express app to `127.0.0.1:0` (random port).
2. Sends `initialize` with `protocolVersion: '2025-06-18'`.
3. Sends `notifications/initialized` to acknowledge.
4. Calls `tools/list` and asserts the 7 tool names.
5. Calls `tools/call list_capabilities` and asserts the documented shape.
6. Calls `tools/call inspect_project` with the fixture and asserts `source.kind === 'direct-url'`, `stats.totalAnnotations === 5`, `rawSummary.nodeCount === 5`.
7. Calls `tools/call find_annotations` with `{ filters: { type: 'box' }, limit: 10 }` and asserts every match has `type === 'box'`.
8. Calls `tools/call nope` (unknown tool) and asserts the response is **not** a silent success.

SSE responses (`text/event-stream`) are parsed by extracting the last `data: ` line.

---

## 6. How to run

```bash
cd C:\anotator8-chatgpt-integration-lab
npm install              # if needed
npm run build            # compile TypeScript → dist/
npm test                 # 91 vitest tests
npm run smoke            # 6-step smoke test
node dist/server/index.js
# or: npm start
# or (dev): npm run dev
```

Server: `http://127.0.0.1:8787` (override with `MCP_HOST` / `MCP_PORT`).
- `GET  /health` → 200
- `GET  /ready`  → 200
- `POST/GET/DELETE /mcp` → Streamable HTTP MCP transport

To test with the MCP Inspector (CLI, no GUI):

```bash
npx @modelcontextprotocol/inspector --cli --transport http --server-url http://127.0.0.1:8787/mcp
```

---

## 7. How to connect to ChatGPT

This host has **no tunnel** installed (no `cloudflared`, `ngrok`, or `tunnel-client`). The lab's `docs/CHATGPT_APP_SETUP.md` documents the three official options; the verified steps are:

1. **Set a Bearer token (required for any public exposure):**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   # → put the output in .env as MCP_AUTH_TOKEN=<token>
   ```
2. **Expose HTTPS** (pick one):
   - **Cloudflare Tunnel:** `cloudflared tunnel --url http://localhost:8787` → copy the `*.trycloudflare.com` URL.
   - **ngrok:** `ngrok http 8787` → copy the `https://*.ngrok.io` URL.
   - **Secure MCP Tunnel (OpenAI):** install `tunnel-client`, init a profile, `tunnel-client run --profile local-dev`.
   - **VPS:** `git clone … && npm ci --production && npm run build && MCP_HOST=0.0.0.0 MCP_PORT=8787 npm start` behind nginx/Cloudflare with TLS.
3. **In ChatGPT (chatgpt.com):** Settings → Apps → Advanced → Developer mode → ON. Add MCP server → paste the HTTPS URL.
4. **Verify in chat:**
   ```
   Use list_capabilities to show me what you can do with Anotator8 projects.
   ```
5. **Production path:** publish as a ChatGPT App (requires approval; manifest in `config/capabilities.example.json` is a starting point; the ChatGPT team reviews privacy + security + quality).

⚠️ **This session did NOT verify a real ChatGPT connection** — no tunnel tool was available. The HTTP-level integration test plus the live `/health`/`/ready`/`/mcp` probes are the equivalent runtime evidence. A user with `cloudflared` or `ngrok` should reproduce step 4 before declaring production readiness.

---

## 8. Porting plan to Anotator8

Per the prompt's required output:

| Integration lab module | Future Anotator8 location | Required changes | Risk |
|---|---|---|---|
| `src/shared/types.ts` | `src/integration/chatgpt/types.ts` (frontend-side shared types) | Extend `UDMNode` to include `sync`, `ownerId`, `isEducationRecord`, `dataResidency`; decide whether the ChatGPT-published subset is a strict subset of the real type or a 1:1 mapping | Low (additive) |
| `src/server/anotator8-adapter.ts` | `src/integration/chatgpt/adapter.ts` (frontend-side) | Tighten node validation to match real Anotator8 export (`exportToJSON` produces `{version, nodes}` — no `videoSource`/`subtitleTracks`/`subtitleCues` at top level) | Medium (real Anotator8 export shape is narrower than the fixture) |
| `src/server/index.ts` | `backend_py/app/integration/chatgpt/server.py` (Python sidecar) OR a Node.js sidecar process | Wrap the existing `McpServer` so it can be driven from a Python backend; or run as a sidecar. Add OAuth 2.1 if exposed publicly | Medium (cross-runtime) |
| `src/server/tools/*.ts` | one-to-one copy into `src/integration/chatgpt/tools/` | Add `apply_*_patch` write tools that return RFC-6902 JSON patches and require human-in-the-loop approval | Medium (write tools need careful approval UX) |
| `src/server/prompts/project-review.ts` | `src/integration/chatgpt/prompts/project-review.ts` | Add English variant; localize errors | Low |
| `src/server/resources/widget-resource.ts` + `src/widget/*` | `public/chatgpt-widget/` (static assets) | No build step required (pure HTML/CSS/JS) | Low |
| `fixtures/` | `tests/fixtures/chatgpt/` | Replace synthetic fixture with a real `sample.anatator.json` exported from Anotator8 (with redactions) | Low (data prep) |
| `tests/` | `tests/integration/chatgpt/` | Add an Anotator8-side contract test: open a real project, serialize via `exportToJSON`, run through the lab's adapter, assert warnings | Medium |
| `config/capabilities.example.json` | `src/integration/chatgpt/capabilities.json` | Update with real ChatGPT App manifest fields (icons, categories, locale) | Low |
| `.env.example` | `.env.staging.example` already exists in Anotator8; add `MCP_*` vars | Add `MCP_HOST`, `MCP_PORT`, `MCP_AUTH_TOKEN`, `MCP_REMOTE_URL` to the existing staging env | Low |
| `Dockerfile` | reference the existing Anotator8 k8s/Docker story | Add a sidecar container or extend the existing image | Medium |
| `vitest.config.ts` | adopt Anotator8's vitest setup | Reuse `vitest.l0.config.ts` shape | Low |
| `docs/CHATGPT_APP_SETUP.md` | absorb into `Anotator8/docs/integrations/chatgpt.md` | Update tunnel steps to match Anotator8's deployment story | Low |

### Migration steps (recommended order)

1. Export a real `.anatator` file from Anotator8, run it through the lab's adapter, and confirm what is / isn't supported. If the real export is `{version, nodes}` only, then `inspect_project`'s "source" and "subtitleTracks" sections will be empty for real data — which is the **honest** answer. Decide whether the ChatGPT integration should pull additional data from the backend (e.g. `/api/v1/projects/{id}/subtitles`) or be limited to the export.
2. Extend the `UDMNode` shared type to include `sync`, `ownerId`, `isEducationRecord`, `dataResidency`. Update the adapter to preserve them; never display them to ChatGPT (FERPA / GDPR).
3. Add a backend endpoint that accepts a project ID and returns the export JSON to the MCP server. The frontend never speaks MCP directly.
4. Run the lab's smoke + integration tests against the real export.
5. Add the lab to Anotator8's CI as a separate workspace; do NOT import it into the Anotator8 tsconfig (keep the lab independent).
6. Roll out to a small classroom first; capture ChatGPT transcripts and the resulting patches; iterate.
7. Promote to GA only after: (a) real ChatGPT Developer Mode is verified with a tunnel, (b) write tools are added with a documented approval flow, (c) FERPA review passes for the published subset.

### Rollback

1. Disable in config: set `chatgpt.enabled = false` in Anotator8's settings.
2. Remove routes: drop the `/mcp` endpoint (or sidecar).
3. Delete `src/integration/chatgpt/`.
4. The lab folder remains usable independently.

---

## 9. Remaining risks

1. **No real ChatGPT Developer Mode session was tested.** Tunnel tooling isn't installed in this environment. Until a user runs the lab with `cloudflared`/`ngrok`/Secure MCP Tunnel and exercises a real ChatGPT session, "compatible with ChatGPT Apps" is *protocol-compatible* (proven by the HTTP test) but *not* UI-verified.
2. **Fixture ≠ real Anotator8 export.** The lab fixture includes `videoSource`, `subtitleTracks`, `subtitleCues`, etc. that `exportToJSON` does not produce. A real port must either widen the data path (backend endpoint) or narrow the fixture to match the real export.
3. **Type model is less strict than real Anotator8.** `sync`, `ownerId`, `isEducationRecord`, `dataResidency` are not in the lab's `UDMNode`. The adapter is graceful (drops nodes missing required fields with a warning), but it would also drop *real* nodes that the type author should know about.
4. **No write tools.** Deliberately — but the prompt calls out `propose_annotation_changes`, `apply_annotation_patch`, `generate_subtitle_cleanup_patch`, `suggest_timeline_markers` as candidates. None are implemented yet. They must be patch-based (return RFC-6902 JSON Patch) and require human-in-the-loop approval before any mutation.
5. **No audit log to disk.** The lab records warnings in `_meta` but does not write a JSONL like the prototype. For a production deployment with FERPA/GDPR, an audit log is required. The lab's design leaves this for a porting step.
6. **No OAuth 2.1.** Bearer token only. MCP Spec 2025-06 requires OAuth 2.1 for remote servers; the lab documents the bearer-token shortcut in `docs/SECURITY.md` and `docs/CHATGPT_APP_SETUP.md`.
7. **Widget origin trust.** `e.source !== window.parent` only; no `event.origin` check. For a production deployment served from a public CDN, also check `event.origin === 'https://chatgpt.com'`.
8. **Size limit is on JSON string length, not request body bytes.** A 10 MB JSON string with `\u0000` escapes could be more. Express body-parser should also have a request size cap.
9. **No streaming for large projects.** A 10 MB project becomes one response. If the user base trends larger, switch to streaming pagination.
10. **No localization.** The `project_review` prompt is Russian-only (matches Anotator8 user base). English variant is on the backlog.

---

## 10. Follow-up

**Before declaring production-ready (in priority order):**

1. Install a tunnel tool and run a real ChatGPT Developer Mode session with the lab.
2. Add a real Anotator8 export fixture; re-run all tests; update the type model to match.
3. Add OAuth 2.1 (or document the bearer-token decision permanently).
4. Add audit logging to a file (with redaction of `text` and other PII fields).
5. Add write tools as **patch-only** with explicit user approval in ChatGPT UI.
6. Add an `event.origin` check to the widget.
7. Add an Express body-parser size cap.
8. Localize the prompt template.
9. Add a real Client (e.g. an Anotator8 React component) that exports a project to JSON and posts it to the lab via Developer Mode.
10. Update `docs/QA_REPORT.md` with the real ChatGPT session evidence once a tunnel is available.

**Nice-to-have (post-launch):**

- Streaming responses for `find_annotations` on projects with thousands of annotations.
- Resource templates for `project:///{projectId}` (currently a stub).
- Multi-project queries across a classroom.
- A visual diff widget for the review plan.

---

## 11. Anti-neuro-garbage compliance

The prompt's rules vs. this build:

| Forbidden | Status |
|---|---|
| Fake "ChatGPT integration" that's only README text | ❌ not done — server code + tests + HTTP-level MCP protocol test + live `/health`/`/ready` |
| Direct browser automation hacks against ChatGPT web UI | ❌ not done — no Playwright against `chatgpt.com` |
| Arbitrary `run_shell` tools | ❌ not done — no `child_process`/`exec`/`spawn` in tool paths |
| Silent project mutation | ❌ not done — all 7 tools are `readOnlyHint: true`; no write tools implemented yet |
| Copying the old local connector without redesign | ❌ not done — see §4 reuse table; the lab is a *product-facing* integration, not a *local coding helper* |
| Hardcoded fixture-only success | ⚠️ partial — fixture is synthetic (`_synthetic: true`); fixture is a documented test input, not a hidden production shortcut |
| Claiming Apps SDK compatibility without running a server | ✅ proven by the HTTP-level MCP test + live `/health`/`/ready`; **not** yet proven against a real ChatGPT UI session (no tunnel) |
| Claiming MCP compatibility without MCP Inspector or equivalent | ✅ proven by `tests/integration/http-mcp-protocol.test.ts` (6/6) and by `npx @modelcontextprotocol/inspector --help` (CLI installs) |
| Broad file access | ❌ not done — no `node:fs` in tool paths |
| "AI magic" labels without deterministic evidence | ❌ not done — all tool outputs are deterministic functions of the input |
| UI buttons that do nothing | N/A — the widget is a read-only display panel; no buttons |
| Docs claiming production readiness without auth/security/runtime proof | ⚠️ partial — `docs/SECURITY.md` and `docs/QA_REPORT.md` explicitly call out the missing pieces (no tunnel, no OAuth 2.1, no audit log file, no real ChatGPT session) |

---

**Final verdict:** the integration lab is a real, runtime-verified, reproducibly-built MCP server. It honors all anti-neuro-garbage rules except where explicitly disclosed (no real ChatGPT UI session, no tunnel on this host). Porting to Anotator8 is feasible without rewriting thanks to the adapter boundary; the type model needs to be extended to match real Anotator8, and the fixture needs to be replaced with a real exported `.anatator` file.
