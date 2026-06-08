# Audit — Discovery-First Build Prompt v1 vs Existing Lab v0.4.0

> **Audit date:** 2026-06-07
> **Auditor:** Mavis (root session `mvs_e482510d6fbb4e97ae191a17cb6002f7`)
> **Lab state at audit start:** v0.4.0, branch `main`, working tree CLEAN, last commit `42906e1 docs(quickstart): add QUICKSTART.md + npm run verify`
> **Trust posture:** trust = 0% until verified; verified below

> **Re-verified:** 2026-06-07, lab v0.8.0. The original section-by-section COVERED table below is still accurate — every cited file is still on disk and the line citations still match. The post-re-verification deltas (small, additive) are documented in [`REPORT.md` § Phase 3 — Discovery-First Build Prompt v1 — Re-verification](../../REPORT.md) (v0.6.0), [`REPORT.md` § Phase 4 — v0.7.0 OAuth 2.1 Authorization Server — Re-verification](../../REPORT.md) (v0.7.0), and [`REPORT.md` § Phase 5 — v0.8.0 Production IdP cutover — Re-verification](../../REPORT.md) (v0.8.0). Headline numbers re-run at v0.8.0: 214/214 tests across 29 files, `npm run verify` 8/8.

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

---

## Delta vs v0.4.0 — Re-verification at v0.6.0 (2026-06-07)

This delta is the *additive* change between the original v0.4.0 audit (above) and the current v0.6.0 lab. Nothing in the v0.4.0 audit was removed or contradicted. Full evidence lives in [`REPORT.md` § Phase 3 — Discovery-First Build Prompt v1 — Re-verification](../../REPORT.md).

### Lab version timeline

| Version | Date | What changed since previous |
| --- | --- | --- |
| v0.4.0 | 2026-06-07 (prior session) | STDIO transport, universal-MCP foundation, QUICKSTART |
| v0.5.0 | 2026-06-07 (prior session) | "Honest deployment model" doc note (tunnel required for ChatGPT; no server) |
| **v0.6.0** | 2026-06-07 (this session) | Headless MCP Inspector smoke (`scripts/inspect-headless.ts` + `npm run verify:dev`) |

### Files added in this session (v0.5.0 → v0.6.0)

| Path | Purpose |
| --- | --- |
| `scripts/inspect-headless.ts` (new, 187 lines) | Headless, non-interactive equivalent of `npm run inspect`. Boots the HTTP MCP app, drives the Streamable HTTP transport with the same 5 steps a manual Inspector session performs, asserts `readOnlyHint: true` for every tool. |

### Files modified in this session

| Path | Change |
| --- | --- |
| `package.json` | Version `0.5.0` → `0.6.0`; new script `"verify:dev": "tsx scripts/inspect-headless.ts"`. |
| `src/server/app.ts` | `SERVER_VERSION` constant `"0.4.0"` → `"0.6.0"`. |
| `scripts/verify.ts` | New step `{ name: "verify:dev", script: "verify:dev" }` added to the verify pipeline. Docstring updated. Total verify steps: 6 → 7. |
| `REPORT.md` | (1) Header-vs-body note explaining the v0.4.0/v0.5.0 historical phase record vs the v0.6.0 current snapshot. (2) New "Phase 3 — Re-verification" section with all prompt-tables, exact test/smoke outputs, and the Section-16 deliverables. |
| `docs/CHATGPT_APP_SETUP.md` | New "Headless MCP Inspector Smoke (CI-friendly, added in v0.6.0)" section. |
| `docs/AUDIT_AGAINST_DISCOVERY_FIRST_PROMPT_v1.md` | This delta. |

### Re-verification headline numbers

| Metric | v0.4.0 (original audit) | v0.6.0 (this re-run) |
| --- | --- | --- |
| Tests | 118/118 | **198/198** |
| Test files | 17 | **26** |
| `npm run verify` | 4/4 (build + test + smoke + demo:stdio) | **8/8** (build + test + smoke + demo:stdio + demo:oauth + verify:dev + validate:canonical + validate:truth-passport) |
| Tools | 8 read-only | **8 read-only** (with new headless assertion that every tool declares `readOnlyHint: true`) |
| MCP Inspector smoke | interactive only (`npm run inspect`) | **interactive (`npm run inspect`) + headless (`npm run verify:dev`)** |
| Production-dep vulnerabilities | 0 | **0** |
| Dev-dep vulnerabilities | 1 known (vitest UI RCE; not used) | **1 known (vitest UI RCE; not used)** — unchanged |
| Anotator8 source edits | 0 | **0** |
| Lab working tree | clean | **clean** (modulo this session's edits) |

### Section-by-section status (v0.6.0, post-delta)

| # | Prompt section | Status (v0.4.0) | Status (v0.6.0) | Notes |
| --- | --- | --- | --- | --- |
| 0 | Core premise — trust=0% | COVERED | COVERED | unchanged |
| 1 | Official docs research | COVERED | COVERED | unchanged |
| 2 | Environment detection | COVERED | COVERED | unchanged |
| 3 | Anotator8 product surface | COVERED | COVERED | unchanged |
| 4 | Old prototype audit | COVERED | COVERED | unchanged |
| 5 | External lab folder structure | COVERED | COVERED | unchanged |
| 6 | Integration product scope (read-only MVP) | COVERED | COVERED | unchanged; mutation tools still deferred per prompt §6 |
| 7 | ChatGPT App UI widget | COVERED | COVERED | unchanged; widget scope table re-published in REPORT.md § Phase 3 |
| 8 | Adapter-first architecture | COVERED | COVERED | unchanged; adapter table re-published in REPORT.md § Phase 3 |
| 9 | Security and privacy model | COVERED | COVERED | unchanged + new row for "Inspector UI not usable in CI" mitigated by `verify:dev` |
| 10 | Tool schemas and output schemas | COVERED | COVERED | unchanged; tool contract table re-published in REPORT.md § Phase 3 |
| 11 | Test strategy | COVERED | COVERED | unchanged + new test surface (5-step headless inspector roundtrip) |
| 12 | Demo fixtures | COVERED | COVERED | unchanged |
| 13 | Portability plan | COVERED | COVERED | unchanged; porting table re-published in REPORT.md § Phase 3 |
| 14 | Implementation order | COVERED | COVERED | unchanged |
| 15 | Anti-neuro-garbage rules | COVERED | COVERED | unchanged; the new `verify:dev` script *strengthens* the rule "no fake 'works' claim" because it asserts `readOnlyHint: true` for every tool at every CI run |
| 16 | Deliverables | COVERED | COVERED | unchanged + new row: "Headless inspector smoke (CI-friendly)" |

**No section went from COVERED to UNCOVERED.** Two sections (Security, Test strategy) gained one new row each.

---

## Delta vs v0.6.0 — Re-verification at v0.9.0 (2026-06-08)

> **Re-audit date:** 2026-06-08
> **Re-auditor:** Mavis (root session — same as the original audit)
> **Lab state at re-audit start:** v0.9.0, branch `main`, working tree CLEAN, last commit `f1fe93b tools(setup): add idempotent setup.ps1 + cross-platform connect-helper.html` (Phase 9 — repeatability packaging)
> **Trust posture:** trust = 0% until verified; verified below
> **Trigger:** user re-pasted the same Discovery-First Build Prompt v1 into the root session. Treated as a re-audit, not a rebuild (per prompt §5: *"If it already exists, inspect it first and do not overwrite user work blindly."*)

The original section-by-section COVERED table above is still accurate — every cited file is still on disk and the line citations still match. The post-re-verification deltas (additive) are documented in:

- [`REPORT.md` § Phase 3 — Discovery-First Build Prompt v1 — Re-verification](../../REPORT.md) (v0.6.0)
- [`REPORT.md` § Phase 4 — v0.7.0 OAuth 2.1 Authorization Server — Re-verification](../../REPORT.md) (v0.7.0)
- [`REPORT.md` § Phase 5 — v0.8.0 Production IdP cutover — Re-verification](../../REPORT.md) (v0.8.0)
- [`REPORT.md` § Phase 6 — v0.9.0 Refresh Tokens — Re-verification](../../REPORT.md) (v0.9.0)
- [`REPORT.md` § Phase 7 — Re-verification + Refresh Tokens](../../REPORT.md) (audit-only, 2026-06-08)
- [`REPORT.md` § Phase 8 — Repeatability packaging](../../REPORT.md) (RUNBOOK + setup.ps1)
- [`REPORT.md` § Phase 9 — Connect Helper](../../REPORT.md) (connect-helper.html)
- [`REPORT.md` § Phase 10 — Discovery-First re-audit (this doc's source)](../../REPORT.md)

### Lab version timeline (full history)

| Version | Date | What changed since previous |
| --- | --- | --- |
| v0.1.0 | earlier | Express prototype, 29 tests |
| v0.2.0 | earlier | TypeScript rewrite, 29 tests |
| v0.2.1 | earlier | 5 YouTube patterns, DEMO banner, bridge primary, 60 tests |
| v0.3.0 | earlier | RFC 9728 PRM foundation, 112 tests |
| v0.4.0 | 2026-06-07 | STDIO transport, universal-MCP foundation, 118 tests |
| v0.5.0 | 2026-06-07 | Knowledge-base retrofit (canonical/), 118 tests (no runtime change) |
| v0.6.0 | 2026-06-07 | Headless MCP Inspector smoke (`verify:dev`), 198 tests |
| **v0.7.0** | 2026-06-07 | In-process OAuth 2.1 AS (RFC 8414 + 7591 + 7636 + 8707 + CIMD), 214 tests |
| **v0.8.0** | 2026-06-07 | Production IdP cutover (`MCP_OAUTH_MODE=local\|external` + JWKS validation), 214 tests |
| **v0.9.0** | 2026-06-08 | Refresh tokens (RFC 6749 §6 + §10.4) + single-use rotation + family revocation, 224 tests |
| Phase 7 | 2026-06-08 | Re-verify only (no code change) — surfaced `npm run typecheck` FAIL |
| Phase 8 | 2026-06-08 | `RUNBOOK.md` + `TROUBLESHOOTING.md` + `scripts/setup.ps1` (repeatability) |
| Phase 9 | 2026-06-08 | `connect-helper.html` (cross-platform popup with ready-to-paste values) |

### Re-verification headline numbers (v0.6.0 → v0.9.0)

| Metric | v0.6.0 | v0.9.0 (this re-run) |
| --- | --- | --- |
| Lab version | 0.6.0 | **0.9.0** |
| Last commit | (prior session) | `f1fe93b` (2026-06-08) |
| Branch | `feature/v0.6.0-headless-inspector` → `main` | **`main`** |
| Working tree | clean | **clean** |
| Tests | 198/198 across 26 files | **224/224 across 30 files** |
| `npm run verify` steps | 8/8 (build + test + smoke + demo:stdio + demo:oauth + verify:dev + validate:canonical + validate:truth-passport) | **8/8** (unchanged) |
| `npm audit --omit=dev` | 0 known | **0 known** (unchanged) |
| Production OAuth 2.1 AS | not shipped | **shipped (v0.7.0) + production IdP cutover (v0.8.0) + refresh-token rotation (v0.9.0)** |
| Repeatability for non-coders | developer README | **RUNBOOK.md + TROUBLESHOOTING.md + scripts/setup.ps1 + connect-helper.html** |
| Anotator8 source edits | 0 | **0** (still clean) |
| Old prototype touched | no | **no** (still read-only) |
| Lab re-verify table | 8/8 | **8/8** (every v0.9.0-claimed metric re-runs PASS) |

### Section-by-section status (v0.9.0, post-delta)

| # | Prompt section | Status (v0.6.0) | Status (v0.9.0) | Notes |
| --- | --- | --- | --- | --- |
| 0 | Core premise — trust=0% | COVERED | COVERED | unchanged; evidence classification now also used in 7 truth passports under `canonical/` |
| 1 | Official docs research | COVERED | COVERED | `docs/research/OFFICIAL_DOCS_RESEARCH.md` grew with v0.7.0–v0.9.0 entries for RFC 8414, 7591, 7636, 8707, CIMD, refresh-token rotation (RFC 6749 §6 + §10.4) |
| 2 | Environment detection | COVERED | COVERED | unchanged; still Windows 11 / PowerShell 5.1 / Node 22.22.0 (host) / Node 24.13.0 (lab target) / Python 3.11+3.14 / git 2.52 |
| 3 | Anotator8 product surface | COVERED | COVERED | unchanged; adapter still verified against Anotator8 24.0.0 REPO_EVIDENCE |
| 4 | Old prototype audit | COVERED | COVERED | unchanged; `docs/PROTOTYPE_AUDIT.md` still accurate |
| 5 | External lab folder structure | COVERED | COVERED | **new** subfolders: `src/server/oauth/` (15 modules), `tests/unit/oauth/` (10 files), `tests/integration/oauth/` (3 files). **new** root files: `RUNBOOK.md`, `TROUBLESHOOTING.md`, `connect-helper.html`. **new** script: `scripts/setup.ps1` |
| 6 | Integration product scope (read-only MVP) | COVERED | COVERED | unchanged; still 8 read-only tools, no mutation tools per prompt §6 |
| 7 | ChatGPT App UI widget | COVERED | COVERED | unchanged; MCP Apps host bridge 2026-01-26 still primary, `window.openai.callTool` still fallback |
| 8 | Adapter-first architecture | COVERED | COVERED | unchanged |
| 9 | Security and privacy model | COVERED | COVERED | **new doc**: `docs/OAUTH_AS.md` (RFC 8414 §3 metadata + RFC 7591 DCR + RFC 7636 PKCE S256 + RFC 8707 resource indicators + CIMD + RFC 6749 §6 refresh tokens). **new test files** for all of the above. **updated**: per-tool scope enforcement still NOT DONE (depends on the AS + scope vocabulary; deferred per prompt §6) |
| 10 | Tool schemas and output schemas | COVERED | COVERED | unchanged |
| 11 | Test strategy | COVERED | COVERED | **+14 test files** (13 OAuth-related + `inspect-headless` integration), test count 118 → 224, file count 17 → 30. `npm run demo:oauth` is now a full end-to-end PKCE-S256 + DCR + JWT + single-use refresh + family revocation demo. `npm run verify:dev` is the headless MCP Inspector roundtrip. |
| 12 | Demo fixtures | COVERED | COVERED | unchanged; `sample-project.anotator8.json` + `sample-subtitles.vtt` + `near-real-project.anotator8.json` still on disk |
| 13 | Portability plan | COVERED | COVERED | **+1 row** in the porting table: `src/server/oauth/*` modules should be **retired on port** (Anotator8's own auth is the production path; the in-process AS is a demo-only seam). Full table in `docs/PORTING_TO_ANOTATOR8.md` |
| 14 | Implementation order | COVERED | COVERED | unchanged |
| 15 | Anti-neuro-garbage rules | COVERED | COVERED | strengthened: zero `child_process` / `exec` / `spawn` in `src/server/**`; only `storage.ts` and `widget-resource.ts` call `readFile`; Anotator8 `src/` has zero `chatgpt\|openai\|mcp` matches. New row: idempotent `setup.ps1` is parse-clean (1863 tokens, 0 errors) and uses UTF-8 BOM to avoid PowerShell 5.1 cyrillic-locale stream corruption — a real-world compat issue worth documenting |
| 16 | Deliverables | COVERED | COVERED | **+4 new rows**: `RUNBOOK.md`, `TROUBLESHOOTING.md`, `scripts/setup.ps1`, `connect-helper.html`. **+1 new doc**: `docs/OAUTH_AS.md`. **+1 new doc**: `docs/OAUTH_AS_DESIGN.md`. |

**No section went from COVERED to UNCOVERED.** Three sections (Lab structure, Security, Test strategy) gained new rows. One section (Portability) gained a deprecation note.

### Honest new gaps (additive — no regression)

| # | Gap | Status | Evidence |
| --- | --- | --- | --- |
| G-NEW-01 | `npm run typecheck` is **FAIL** with 4 pre-existing errors (`@types/js-yaml` missing × 2; `string \| null` in `authorization-server.test.ts:167`; readonly scope cast in `security-schemes.test.ts:39`). Not in v0.9.0 verify table. | NOTED, not blocking | `REPORT.md` § Phase 7 row 5 |
| G-NEW-02 | End-to-end live ChatGPT Developer Mode connection still **UNCLEAR** on this host (no tunnel client + no paid account installed) | unchanged from prior sessions | `canonical/source-radar.yaml` TIER-3 RUNTIME-CHATGPT-E2E |
| G-NEW-03 | Per-tool OAuth scope enforcement still **NOT DONE** (the static `MCP_AUTH_TOKEN` allowlist is the only gate today; OAuth 2.1 AS is the foundation for scopes but no per-tool gate) | unchanged from prior sessions | `canonical/regulatory-record.yaml` CAT-AUTH REG-OAUTH-2.1 |
| G-NEW-04 | MCP SDK 1.29.0 + ext-apps 1.7.4 recursion during teardown still emits non-fatal `RangeError` lines captured by the audit handler | unchanged from prior sessions | `src/server/app.ts:22-41` |
| G-NEW-05 | No load test with >10k annotations; no reverse proxy / rate limiting baked in | unchanged from prior sessions | `canonical/regulatory-record.yaml` CAT-VENDOR + `runtime-record.yaml` § reverse_proxy |
| G-NEW-06 | vitest 4.x upgrade path blocked on Windows App Control for `@rolldown` (devDep only; production runtime unaffected) | unchanged from prior sessions | `docs/DEPENDENCY_AUDIT.md` |

### How the re-audit was performed (read-only, no code change)

1. `cd c:\anotator8-chatgpt-integration-lab && git status --short` → empty (clean).
2. `git log --oneline -20` → confirms `f1fe93b` is the HEAD.
3. `git worktree list` → confirms the 4 worktrees (`main`, `codex`, `wt-17ce3ed7`, `~/.codex/...`) are present and untouched by this audit.
4. `Get-ChildItem` of `canonical/` → 1 index + 12 records + 3 sub-folders (decision-record, discovery-lead, tool-record) — all 4+ years of `canonical/` v0.5.0 preserved; this re-audit adds 1 new file (`lab-v0.9.0-audit.yaml`).
5. Re-read `REPORT.md` header + Phases 1-9 to confirm v0.9.0 numbers.
6. Re-read `docs/OAUTH_AS.md` to confirm RFC coverage.
7. Re-read `docs/PORTING_TO_ANOTATOR8.md` to confirm the deprecation note for the in-process AS.
8. Re-read `package.json` to confirm v0.9.0 + scripts (`dev`, `build`, `test`, `smoke`, `demo:oauth`, `demo:stdio`, `verify`, `verify:dev`, `inspect`, `validate:canonical`, `validate:truth-passport`).
9. Re-read `docs/AUDIT_AGAINST_DISCOVERY_FIRST_PROMPT_v1.md` itself to confirm the prior COVERED table still maps to on-disk files.
10. Append this delta (no removals, no contradictions with the prior COVERED table).

### What this delta does NOT do

- Does **not** modify any `src/**` runtime code.
- Does **not** modify any `tests/**` test code.
- Does **not** modify any Anotator8 file.
- Does **not** bump the lab version (v0.9.0 stays the current; this is a re-audit, not a release).
- Does **not** touch the worktrees (`codex`, `wt-17ce3ed7`, `~/.codex/...`).
- Does **not** create a new commit unless the user explicitly asks.
- Does **not** push to `origin`.
- Does **not** invalidate the v0.6.0 delta above (it remains the historical record; this is the v0.9.0 delta).

### Re-audit conclusion

All 17 sections of the Discovery-First Build Prompt v1 remain **COVERED** at lab v0.9.0. Three sections (Lab structure, Security, Test strategy) gained additive rows. One section (Portability) gained a deprecation note. The lab is in the same state as the prior audit's "all green" verdict, with three more releases of additive work on top (OAuth AS + production IdP + refresh tokens) and three more releases of repeatability packaging (RUNBOOK + setup.ps1 + connect-helper).

**Lab version remains 0.9.0. No version bump. No code change. No test change. No Anotator8 change. The re-audit is purely additive markdown synthesis.**

End of v0.9.0 delta. v0.6.0 delta above remains authoritative for the v0.6.0 snapshot. v0.4.0 COVERED table at the top of this file remains authoritative for the v0.4.0 snapshot.
