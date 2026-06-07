# Audit — Discovery-First Build Prompt v1 vs Existing Lab v0.4.0

> **Audit date:** 2026-06-07
> **Auditor:** Mavis (root session `mvs_e482510d6fbb4e97ae191a17cb6002f7`)
> **Lab state at audit start:** v0.4.0, branch `main`, working tree CLEAN, last commit `42906e1 docs(quickstart): add QUICKSTART.md + npm run verify`
> **Trust posture:** trust = 0% until verified; verified below

This audit compares the requirements in the "Discovery-First Build Prompt v1" (sections 0–16) against the current state of `C:\anotator8-chatgpt-integration-lab\`. The prompt was treated as a checklist — **not** as a build plan, because the lab is already at v0.4.0 with full evidence of working code, tests, smoke, and docs.

The user said: "If it already exists, inspect it first and do not overwrite user work blindly." That is the path taken.

## Verification snapshot (re-run at audit time)

```text
$ npm run verify
--- [build]   OK ---
--- [test]    OK ---   (Test Files 17 passed (17), Tests 118 passed (118))
--- [smoke]   OK ---   (SMOKE PASS, OAuth PRM resource=... bearer=header)
--- [demo:stdio] OK --- (STDIO SMOKE PASS)
=== verify summary ===
passed: 4/4
all checks passed
```

Anotator8 untouched: `git status` in `C:\Anotator8` shows only pre-existing
modifications (`PRODUCT_READY.md`, `README.md`, `VideoExportButton.tsx`,
`ExportVideoButton.title.test.ts`) — **none** of which were introduced by the
lab. `Get-ChildItem -Recurse` over `C:\Anotator8\src` for any file matching
`chatgpt|openai|mcp` returns **zero** files. REPO_EVIDENCE-backed.

---

## Section-by-section mapping

| # | Prompt section | Status | Evidence (REPO / OFFICIAL_DOC / RUNTIME / INFERENCE) | File(s) |
|---|---|---|---|---|
| 0 | Core premise — trust=0% until verified; evidence classification | **COVERED** | Evidence classification table in `ARCHITECTURE.md` and `OFFICIAL_DOCS_RESEARCH.md`. Used throughout this audit. | `docs/ARCHITECTURE.md`, `docs/research/OFFICIAL_DOCS_RESEARCH.md` |
| 1 | Official docs research (Apps SDK + MCP) | **COVERED** | 13-row table covering Apps SDK Quickstart 2026-01-26, Apps SDK Reference, Auth, Security, Testing, MCP Tools/Resources/Prompts 2025-06-18, RFC 9728, RFC 6750, MCP Inspector, MCP SDK + ext-apps 1.7.4, SDK upstream bug. Includes "What it says / Impact / Risk if ignored" columns as the prompt requires. | `docs/research/OFFICIAL_DOCS_RESEARCH.md` (51 lines) |
| 2 | Environment detection | **COVERED** | Environment table in `REPORT.md` and `ARCHITECTURE.md`. Re-verified at audit time: Windows 11 Pro / PowerShell 5.1; Node v24.13.0; Python 3.11.15 + 3.14.0; git 2.52.0; Anotator8 at `C:\Anotator8`; old prototype at `C:\chat-gpt-mcp-app`; lab on `main`, clean tree. | `REPORT.md` § Section 2, `docs/ARCHITECTURE.md` § Environment |
| 3 | Anotator8 product surface discovery | **COVERED** | 12-row surface map (project save/open, annotation model, canvas, video source, subtitles, timeline, export/import, AI remnants, sync metadata, Loro CRDT, FERPA/COPPA/GDPR, locale enum). Every row cites REPO_EVIDENCE file path. | `docs/PRODUCT_SURFACE.md` (53 lines) |
| 4 | Old prototype audit | **COVERED** | 16-row audit table for `C:\chat-gpt-mcp-app` (FastMCP, profile runner, path guard, audit, auth, schemas, App UI absence, Anotator8 absence, CORS, lifecycle, transport, security). Followed by explicit "What the lab reused vs dropped" matrix. | `docs/PROTOTYPE_AUDIT.md` (49 lines) |
| 5 | External lab folder structure | **COVERED** | All required subfolders exist. Structure matches the prompt's target (with stdio transport, OAuth PRM, CI workflow, near-real fixture, and dependency audit added in v0.3.0/v0.4.0). Working tree clean. | `src/`, `src/server/{tools,resources,prompts,oauth}/`, `src/widget/`, `src/shared/`, `tests/{unit,integration,contract}/`, `scripts/`, `fixtures/`, `docs/`, `docs/research/`, `config/` |
| 6 | Integration product scope — read-only MVP tools | **COVERED** | All 8 read-only tools implemented, no mutation tools: `list_capabilities`, `inspect_project`, `validate_project`, `summarize_annotations`, `find_annotations`, `suggest_labels`, `create_review_plan`, `export_chatgpt_report`. Each declared `readOnlyHint: true, destructiveHint: false, openWorldHint: false`. | `src/server/tools/`, `src/server/tools/index.ts`, `config/capabilities.example.json` |
| 7 | ChatGPT App UI widget | **COVERED** | Widget HTML + CSS + TS with **primary MCP Apps host bridge** (2026-01-26, `ui/initialize` + `ui/notifications/initialized` + `tools/call` via postMessage) **and** legacy `window.openai.callTool` fallback. `bridge-info` span shows which bridge is active. No fake controls. | `src/widget/index.html`, `src/widget/styles.css`, `src/widget/widget.ts`, `tests/contract/widget-bridge.test.ts` |
| 8 | Adapter-first architecture | **COVERED** | `Anotator8Adapter` class: `parse()` (raw → ProjectFilePayload), `normalize()` (raw → NormalizedProject with `source / annotations / subtitles / timeline / metadata / unknownFields / warnings`), `validate()` (raw → ValidationResult with `errors / warnings / checks`). Unknown top-level project fields preserved via `collectUnknownFields()` + `KNOWN_PROJECT_FIELDS` set. | `src/server/anotator8-adapter.ts` (421 lines), `src/shared/types.ts` |
| 9 | Security and privacy model | **COVERED** | 78-line security doc. Covers: what data leaves the machine, what ChatGPT sees, video bytes never read, project JSON handling, local paths allowlisted, secrets not read, 10 MB cap, RFC 6750 bearer auth, RFC 9728 PRM, CORS allowlist (chatgpt.com + chat.openai.com), widget CSP, prompt-injection mitigations, MCP SDK recursion workaround. | `docs/SECURITY.md` (78 lines) |
| 10 | Tool schemas and output schemas | **COVERED** | Every tool uses Zod input + output schemas declared in `registerAppTool`. Errors use typed codes: `invalid_input`, `unsupported_project_version`, `too_large_input`, `missing_field`, `internal_error`, `unsupported_capability`. Raw error messages and absolute paths are NOT leaked in 500 responses. | `src/server/schemas.ts`, `src/server/tools/tool-types.ts`, `src/server/errors.ts` |
| 11 | Test strategy | **COVERED** | **17 test files / 118/118 tests pass** (audit just re-ran). Unit (adapter, validators, schemas, youtube-patterns, rejection-capture, oauth-prm), integration (http-mcp-protocol, tools.inspect-project, tools.validate-project, tools.find-annotations, auth-bypass, oauth-protected-resource, stdio-transport), contract (mcp-tool-contracts, fixtures-compatibility, widget-bridge, near-real-fixture). `npm run smoke` and `npm run demo:stdio` roundtrip. | `tests/`, `npm run verify` output above |
| 12 | Demo fixtures | **COVERED** | Three fixtures: `sample-project.anotator8.json` (synthetic but based on Anotator8 24.0.0 evidence; 3 annotations, 2 unknown fields, 1 orphan cue), `sample-subtitles.vtt`, `near-real-project.anotator8.json` (24 annotations / 3 tracks / 18 cues / 2 unknown fields, generator-driven). | `fixtures/` |
| 13 | Portability plan | **COVERED** | 50-line porting doc with module-to-Anotator8 mapping table, shared-package candidate, "remain external" list, save/open schema needs, UI entry point plan, migration steps, rollback plan. | `docs/PORTING_TO_ANOTATOR8.md` (50 lines) |
| 14 | Implementation order | **COVERED** | The lab was built in earlier sessions following this order; git log shows v0.1.0 → v0.2.0 → v0.2.1 → v0.3.0 → v0.4.0 → quickstart layer. The current prompt's order would have produced the same result; no rebuild needed. | `git log --oneline -15` |
| 15 | Anti-neuro-garbage rules | **COVERED** | Grep-verified: zero `child_process` / `exec` / `spawn` in `src/server/**`. Grep-verified: only `storage.ts` (fixture allowlist) and `widget-resource.ts` (widget source) call `readFile`. Anotator8 src/ has zero `chatgpt\|openai\|mcp` matches. No fake UI. No silent mutation. Every button either works or is absent. | `rg`-style scan in audit, `src/server/`, `docs/SECURITY.md` |
| 16 | Deliverables | **COVERED** | All listed deliverables exist: working lab folder, server code, tools, schemas, adapter, fixtures, tests, smoke, widget, setup docs, security docs, porting guide, QA report, App Store runbook, dependency audit. | This tree |

## Tool contracts (current, post-audit)

| Tool | Purpose | Read/write | Input schema | Output schema | Errors | Tested |
|---|---|---|---|---|---|---|
| `list_capabilities` | Features, limitations, fixture ids | read | empty | Zod: features, limitations, annotationTypes, supportedSubtitleLanguages, fixtureIds | internal_error | contract |
| `inspect_project` | Normalize source / annotations / subtitles / timeline / warnings | read | projectData \| fixtureId, projectId? | Zod: version, source, stats, warnings, unsupportedFields | missing_field, invalid_input, too_large | integration, smoke |
| `validate_project` | Check ids, time ranges, cue refs, source metadata | read | projectData \| fixtureId | Zod: valid, errors, warnings, checks | missing_field, invalid_input, too_large | unit, integration |
| `summarize_annotations` | Count by type / shape / label / timing | read | projectData \| fixtureId | Zod: total, byType, byShape, byLabelPresence, temporalDistribution, warnings | missing_field, invalid_input, too_large | contract |
| `find_annotations` | Filter by type / label / text / confidence / time | read | projectData \| fixtureId, filters?, limit? | Zod: matches, total, truncated, filters | missing_field, invalid_input, too_large | integration, smoke |
| `suggest_labels` | Identify review tasks; NO invented labels | read | projectData \| fixtureId, includeAlreadyLabeled? | Zod: suggestions, limitations | missing_field, invalid_input, too_large | contract |
| `create_review_plan` | Manual review checklist | read | projectData \| fixtureId, focus? | Zod: focus, detectedProblems, suggestions, checklist | missing_field, invalid_input, too_large | contract, http-mcp-protocol (widget calls it) |
| `export_chatgpt_report` | Markdown/JSON report; does NOT write files | read | projectData \| fixtureId, format, includeUnknownFields | Zod: format, filename, content | missing_field, invalid_input, too_large | smoke |

## Anotator8 adapter — what is supported / unsupported / preserved

| Data area | Supported | Unsupported | Unknown preserved |
|---|---|---|---|
| Project top-level | `version`, `videoUrl`, `videoSource`, `locale`, `classroomId`, `classroomName`, `subtitleTracks`, `subtitleCues`, `nodes` | (none — these are the only KNOWN fields) | Anything else in the raw object is collected into `unknownFields` |
| Video source | `local-file`, `direct-url`, `youtube` (5 patterns mirrored from `videoSources.ts:38-44`), `demo` | `loroState` / blob bytes / live streams | Any unrecognized `kind` → `unknown` source kind, warning recorded |
| Annotations | 11 types × 5 shapes (matches Anotator8 evidence) | (none dropped) | Unknown annotation type → warning, preserved with `type: "unknown"` |
| Subtitles | Track + cue normalization; cue-range checks; orphan-track checks | SRT/VTT content beyond cue text (no styling) | Cue `text` (per-locale) previewed only, not interpreted |
| Timeline | Explicit `type: "track"` nodes; implicit fallback when none | Live timeline edits (read-only) | Any unknown node type → warning, preserved |
| Sync / integrity | NOT interpreted; preserved as opaque unknown fields | (intentionally — lab is read-only) | `sync`, `isEducationRecord`, `dataResidency`, `ownerId`, `classroomId`, `loroState` are all preserved but never exposed as data |
| Max input | 10 MB → `IntegrationError("too_large_input", ...)` | n/a | n/a |

## Prototype reuse decision (summary; full table in PROTOTYPE_AUDIT.md)

| Prototype idea | Reused? | Why |
|---|---|---|
| `PermissionGuard`-style path allowlist | YES (improved) | Lab `storage.ts` reads only allowlisted fixture paths inside the lab itself; no `read_file` tool at all |
| `ToolAnnotations(readOnlyHint=True)` pattern | YES | Every tool is `readOnlyHint: true, destructiveHint: false, openWorldHint: false` |
| Bearer auth with token env var | YES (improved) | Lab adds RFC 6750 `WWW-Authenticate` + screaming DEMO-ONLY banner + OAuth PRM (RFC 9728) discovery |
| Stderr audit log | YES (improved) | Lab adds Bearer + `MCP_AUTH_TOKEN=` redaction and 500-char summary cap |
| `run_profile` command runner | NO | Product integration must not run shell; write tools must be patch/proposal based |
| `read_file` / `list_files` / `search_code` | NO | ChatGPT should get normalized data, not raw FS access |
| FastMCP framework | NO | TypeScript for portability to Anotator8 |
| Default `*` CORS | NO | `chatgpt.com` + `chat.openai.com` allowlist plus `CORS_ORIGIN` for additional |
| No output schema | NO | Every tool has a Zod `outputSchema` |
| `config.yaml` profile loading | NO | Env vars + a static `config/capabilities.example.json` template |
| JSONL audit format | NO | Stderr JSON lines via `process.stderr.write` for portability with vitest output |

## Security model (summary; full table in SECURITY.md)

| Risk | Mitigation | Remaining concern |
|---|---|---|
| Demo bearer auth is weaker than OAuth | Optional `MCP_AUTH_TOKEN`; 7-line DEMO-ONLY banner when unset; RFC 6750 401/403 challenge; v0.3.0 adds `resource_metadata="..."` per RFC 9728 §5.1 | Production must add OAuth 2.1 authorization server + per-tool scopes (foundation shipped, AS is next) |
| Project JSON can contain sensitive education records | Read-only, no persistence; `isEducationRecord`, `dataResidency`, `ownerId`, `classroomId` preserved as opaque; `sync`/`integrity`/`loroState` never exposed as data | User must decide whether to share project JSON with ChatGPT at all |
| Widget receives hidden `_meta.projectData` for focus buttons | CSP with no external `connectDomains` / `resourceDomains`; `textContent` only (no `innerHTML`) | Remove or redact `_meta.projectData` before production if not strictly needed |
| OAuth well-known endpoint is unauthenticated by design (RFC 9728 §3.1) | Returns only public metadata; CORS `*` appropriate for discovery | If AS list is sensitive, deploy behind a private AS |
| Dependency vulnerabilities from `npm audit` | Documented in `DEPENDENCY_AUDIT.md`; 4 of 5 resolved by `vitest@^2 → ^3`; 1 critical remains (Vitest UI server RCE — not used) | Needs dependency review before production; `vitest@^4` blocked on Windows App Control for `@rolldown` |
| MCP SDK recursion during teardown | `process.on("unhandledRejection", captureUnhandledRejection)` in `app.ts` captures the `RangeError` to the audit log; tests pass cleanly | Wait for upstream fix or pin to non-buggy SDK version |
| Video bytes | Never read, never uploaded, never decoded; adapter reports only `videoSource` metadata | n/a |
| Local FS | `storage.ts` reads only `fixtures/sample-project.anotator8.json`; `widget-resource.ts` reads only `src/widget/*`; no `child_process` / `exec` / `spawn` in `src/server/**` | n/a |
| Shell exec | Zero matches in `src/server/**` | n/a |
| Arbitrary command execution | Not present | n/a |

## Identified minor issues (not blockers, surfaced for the maintainer)

1. **REPORT.md body uses older numbers in some places.** Header says v0.4.0/118/17; the body phase narratives describe the 0.2.0 → 0.2.1 → 0.3.0 transition (112/15 numbers). The body is a historical record of phase changes, the header is the current snapshot — this is intentional, but a fresh reader may notice the discrepancy.

2. **Top-level clutter from prior session log captures.** Files like `err.txt`, `live*-out.txt`, `server-err.txt`, `verify-*.txt`, `smoke-server-*.txt` exist at the repo root. All are in `.gitignore`, so they don't pollute git, but they clutter `ls`. If desired, they can be moved to `.mavis/` or removed. Not blocking.

3. **Pre-existing untracked Anotator8 changes.** `C:\Anotator8` has uncommitted modifications to `PRODUCT_READY.md`, `README.md`, `VideoExportButton.tsx`, and `ExportVideoButton.title.test.ts`. These are NOT introduced by the lab (verified by file content) and are NOT ChatGPT integration code (grep for `chatgpt|openai|mcp` in `C:\Anotator8\src` returns zero). Surfaced here for visibility, not as a lab issue.

## Honest remaining work (per REPORT.md § Follow-up, re-verified)

1. **OAuth 2.1 authorization server** (token issuance, introspection, JWKS, DCR, token rotation). v0.3.0 ships RFC 9728 discovery foundation; AS endpoints are the next step. Required for public App Store submission.
2. **Live ChatGPT Developer Mode** end-to-end (needs `cloudflared` / `ngrok` + paid ChatGPT account). Protocol is verified to MCP 2025-06-18 via `npm run smoke`; Apps-bridge 2026-01-26 is verified by `tests/contract/widget-bridge.test.ts`; RFC 9728 is verified by `tests/integration/oauth/protected-resource.test.ts`.
3. **MCP SDK 1.29.0 + ext-apps 1.7.4 recursion bug** — workaround in place, root cause is upstream.
4. **No load test** with >10k annotations. Adapter is O(n) on nodes; report generation can hit string length limits for very large projects.
5. **Fixture is synthetic.** Golden fixture exported from real Anotator8 UI is the next step.
6. **No reverse proxy / rate limiting** in the lab server. Production deploys need a reverse proxy (nginx, cloudflared) with rate limiting.
7. **vitest 4.x upgrade path** blocked on Windows App Control for `@rolldown`. Documented in `DEPENDENCY_AUDIT.md`.
8. **Write / proposal tools** (e.g. `propose_annotation_changes`, `apply_annotation_patch`) are intentionally not implemented. They will be added only after the read-only contract is stable, and they will require explicit user approval and return reversible patches.

## Verification command output (exact, just-run)

```text
$ npm run build
> tsc
(0 errors)

$ npm test
 Test Files  17 passed (17)
      Tests  118 passed (118)
   Duration  3.01s

$ npm run smoke
SMOKE PASS
fixture bytes=4768
adapter annotations=3 unknownFields=2
validation valid=true warnings=1
server url=http://127.0.0.1:55679/mcp
oauth resource=http://127.0.0.1:55679/mcp bearer=header
initialize session=cfe34bb8-d3ee-4773-9989-e87920ab62c8
tools=list_capabilities,inspect_project,validate_project,summarize_annotations,find_annotations,suggest_labels,create_review_plan,export_chatgpt_report
inspect={"annotationCount":3,"annotationTypes":{"box":1,"ellipse":1,"arrow":1},"shapeTypes":{"rect":1,"circle":1,"arrow":1},"subtitleTrackCount":1,"subtitleCueCount":1,"timelineTrackCount":2,"warningCount":1,"unknownFieldCount":2}
report chars=639

$ npm run demo:stdio
STDIO SMOKE PASS

$ npm run verify
--- [build]   OK ---
--- [test]    OK ---
--- [smoke]   OK ---
--- [demo:stdio] OK ---
=== verify summary ===
passed: 4/4
all checks passed
```

## How to run

```bash
cd C:\anotator8-chatgpt-integration-lab
npm install
npm run build
npm test           # 118/118 across 17 files
npm run smoke      # PASS (real HTTP roundtrip + OAuth PRM)
npm run demo:stdio # STDIO SMOKE PASS
npm run verify     # 4/4 end-to-end
npm run dev        # HTTP server on http://127.0.0.1:8787/mcp
npm run inspect    # opens MCP Inspector against the local server
```

## How to connect to ChatGPT

See `docs/CHATGPT_APP_SETUP.md` (203 lines). High level (verified against OpenAI Apps SDK Quickstart 2026-01-26):

1. Expose the local server over HTTPS (e.g. `cloudflared tunnel --url http://127.0.0.1:8787` or `ngrok http 8787`).
2. ChatGPT: **Settings → Apps & Connectors → Advanced settings → Developer mode → ON**.
3. **Settings → Connectors → Create**, paste `https://<subdomain>.ngrok.app/mcp`.
4. Set `MCP_AUTH_TOKEN=<random>` and configure connector auth to use Bearer + same token.
5. In a chat, attach the connector and prompt: `Use inspect_project on fixtureId: sample-project. Then validate_project. Then create_review_plan with focus=subtitles.`

The widget will pick the new MCP Apps host bridge (preferred) and fall back to legacy `window.openai.callTool` if needed. The `bridge-info` span shows which bridge is in use.

## Porting plan to Anotator8 (summary; full table in PORTING_TO_ANOTATOR8.md)

| Step | Change | Risk | Verification |
|---|---|---|---|
| 1 | Add a versioned project JSON schema export in Anotator8 so lab and product agree on a contract | Low (additive) | `verify` after adding the schema |
| 2 | Replace `src/shared/types.ts` UDM shape with import from new Anotator8 schema package | Medium (type drift if rushed) | `npm run build` + `npm test` |
| 3 | Replace lab's `parseYouTubeVideoId` with import from `Anotator8\src\application\videoSources.ts` | Low (function is pure) | `tests/unit/youtube-patterns.test.ts` |
| 4 | Add Anotator8 "Export ChatGPT review package" command that calls `createMcpServer` and ships a redacted JSON | Medium (touches UI shell) | `verify` + manual ChatGPT Developer Mode test |
| 5 | Add OAuth 2.1 + per-tool scope checks before any user-data path | High (security-critical) | External security review + MCP Inspector end-to-end |
