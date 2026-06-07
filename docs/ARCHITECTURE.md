# Architecture

## Environment

| Field | Value |
| --- | --- |
| OS / shell | Windows / PowerShell 5.1 |
| Workspace path | `C:\anotator8-chatgpt-integration-lab\` |
| Anotator8 repo path | `C:\Anotator8\` |
| Old prototype path | `C:\chat-gpt-mcp-app\` |
| Current lab branch | `main` (clean working tree) |
| Git clean | Lab: YES; Anotator8: YES (no edits) |
| Node available | YES, `v24.13.0` |
| Python available | YES, `3.11.15` and `3.14.0` |
| Internet available | YES |
| Browser available | UNCLEAR (Playwright not used in this lab) |
| Can run MCP Inspector | YES, `npm run inspect` |
| Can expose tunnel / ChatGPT Developer Mode | UNCLEAR, no `cloudflared` / `ngrok` / `tunnel-client` installed |

## Evidence Classification

| Label | Meaning in this lab |
| --- | --- |
| REPO_EVIDENCE | Read-only inspection of `C:\Anotator8` files/tests/runtime commands |
| PROTOTYPE_EVIDENCE | Read-only inspection of `C:\chat-gpt-mcp-app` |
| OFFICIAL_DOC_EVIDENCE | OpenAI Apps SDK and MCP protocol docs |
| RUNTIME_EVIDENCE | Build, tests, smoke, MCP Inspector availability |
| INFERENCE | Design conclusion based on evidence |
| UNCLEAR | Not proven |

## Anotator8 Product Surface

The full verified surface map is in [`PRODUCT_SURFACE.md`](PRODUCT_SURFACE.md). Summary:

| Surface | User-visible capability | Source files (REPO_EVIDENCE) | Adapter coverage |
| --- | --- | --- | --- |
| Project save/open | Portable `.anatator.json` | `src/application/services/projectFile.ts` | `parse()` accepts the same payload, preserves unknown fields |
| Annotation model | Box, ellipse, arrow; broader enum exists | `src/domain/entities/UDMNode.ts` | `normalize()` mirrors 5-shape enum exactly |
| Canvas / object model | Visual drawing + hit testing | `src/presentation/components/Canvas/*` | Widget is read-only review, not a canvas editor |
| Video source model | Direct URL, YouTube (5 patterns), demo, local file | `src/application/videoSources.ts:38-44` | Adapter mirrors all 5 YouTube patterns; metadata only |
| Subtitles | Tracks, cues, SRT/VTT | `src/application/subtitles/subtitleFormats.ts` | Validator checks cue ranges and orphaned cues |
| Timeline | Studio Beta editor | `src/presentation/components/StudioTimeline/*` | Normalized implicit timeline when no track nodes |
| Export/import | JSON, ZIP, CSV, gated MP4 | `src/domain/export/shipped.ts` | Report export is ChatGPT-only, never writes to disk |
| AI / connector remnants | Experimental plugins, deferred | `src/experimental/plugins/*` | None. Confirmed via `grep` for `chatgpt\|openai\|mcp` in `C:\Anotator8\src\**\*.{ts,tsx}` = 0 matches. |

## Architecture Layers

| Module | Responsibility |
| --- | --- |
| `src/server/index.ts` | `main()` — binds `127.0.0.1:MCP_PORT`, prints demo-mode banner when `MCP_AUTH_TOKEN` unset |
| `src/server/app.ts` | `createMcpServer()` + `createHttpMcpApp()` factories; `unhandledRejection` capture for MCP SDK recursion bug; well-known route |
| `src/server/anotator8-adapter.ts` | Parse raw project data, normalize domain model, validate known fields, preserve unknowns; exports `parseYouTubeVideoId` matching Anotator8's 5 patterns |
| `src/server/schemas.ts` | Zod input/output schemas for every tool |
| `src/server/auth.ts` | Bearer auth (RFC 6750), comma-separated tokens, 401/403 + `WWW-Authenticate`; integrates OAuth metadata URL on challenge |
| `src/server/oauth/protected-resource-metadata.ts` | RFC 9728 metadata document builder, well-known URL computation (path-insertion per §3.1), inverse mapping (§3.3), `WWW-Authenticate` challenge builder (§5.1) |
| `src/server/audit.ts` | Stderr JSON lines, Bearer + `MCP_AUTH_TOKEN` redaction, 500-char summary cap |
| `src/server/errors.ts` | `IntegrationError` with typed codes |
| `src/server/storage.ts` | `loadProjectInput()` — `projectData` OR allowlisted `fixtureId` |
| `src/server/tools/*` | 8 typed read-only tool handlers; `wrapTool()` adds audit + error envelope |
| `src/server/prompts/review-project-prompt.ts` | `review_anotator8_project` prompt with `focus` enum |
| `src/server/resources/widget-resource.ts` | `ui://anotator8/review-widget.html` with CSP |
| `src/widget/*` | Review/control panel; MCP Apps host bridge (primary) + legacy `window.openai.callTool` (fallback) |
| `src/shared/types.ts` | Anotator8 domain + integration model |
| `fixtures/*` | Synthetic Anotator8-like project file with intentional validation warnings |
| `tests/*` | Unit, integration, contract, smoke |

## Widget Scope

| UI element | Purpose | Backed by tool/data | Not pretending to do |
| --- | --- | --- | --- |
| Metrics row | Show latest annotation / subtitle / warning counts | `structuredContent.stats` from tools | Not a live editor |
| Warnings list | Show latest structured warnings | `structuredContent.warnings` | Not validation beyond server output |
| Focus buttons | Call `create_review_plan` only when a bridge is present and hidden `_meta.projectData` is available | New MCP Apps host bridge (`ui/initialize` + `ui/notifications/initialized` + `tools/call`, `protocolVersion: 2026-01-26`) primary; legacy `window.openai.callTool` fallback | Not shown when no bridge is available |
| Bridge-info span | Show which bridge is currently active | Runtime detection | n/a |

**Every button either works or is absent.** No fake controls.

## Transport and Protocol Versions

| Layer | Version | Evidence |
| --- | --- | --- |
| MCP protocol | 2025-06-18 | Smoke test declares it in `initialize`; MCP spec |
| Apps SDK bridge | 2026-01-26 | Widget TS declares `BRIDGE_PROTOCOL_VERSION = "2026-01-26"`; OpenAI Apps SDK quickstart |
| OAuth Protected Resource Metadata | RFC 9728 (April 2025) | `/.well-known/oauth-protected-resource[/<path>]` served at v0.3.0; integration test asserts shape |
| OAuth Bearer | RFC 6750 (October 2012) | `WWW-Authenticate: Bearer realm=..., error=..., resource_metadata=...` on 401/403 |
| Node | 24.13.0 | `node --version` |
| `@modelcontextprotocol/sdk` | 1.29.0 | `package.json` |
| `@modelcontextprotocol/ext-apps` | 1.7.4 | `package.json` |
