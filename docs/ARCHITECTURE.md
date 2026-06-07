# Architecture

## Environment

| Field | Value |
| --- | --- |
| OS / shell | Windows / PowerShell |
| Workspace path | `C:\Users\void7\.codex\worktrees\66c8\anotator8-chatgpt-integration-lab` |
| Anotator8 repo path | `C:\Anotator8` |
| Current lab branch | detached `HEAD` |
| Git clean | Lab: NO after implementation; Anotator8: NO before/without edits |
| Node available | YES, `v24.13.0` |
| Python available | YES, `Python 3.11.15` and `py` reports `3.14.0` |
| Internet available | YES, official docs and npm package install succeeded |
| Browser available | UNCLEAR, not needed for smoke |
| Can run MCP Inspector | YES, `npx -y @modelcontextprotocol/inspector@latest --help` succeeded |
| Can expose tunnel / ChatGPT Developer Mode | UNCLEAR, no tunnel or ChatGPT account state verified |

## Evidence Classification

| Label | Meaning in this lab |
| --- | --- |
| REPO_EVIDENCE | Read-only inspection of `C:\Anotator8` files/tests/runtime commands |
| PROTOTYPE_EVIDENCE | Read-only inspection of `C:\chat-gpt-mcp-app` |
| OFFICIAL_DOC_EVIDENCE | OpenAI Apps SDK and MCP protocol docs |
| RUNTIME_EVIDENCE | Build, tests, smoke, MCP Inspector availability |
| INFERENCE | Design conclusion based on evidence |
| UNCLEAR | Not proven |

## Anotator8 Product Surface Map

| Surface | User-visible capability | Source files | Data model | Runtime/test evidence | Integration relevance |
| --- | --- | --- | --- | --- | --- |
| Project save/open | Portable `.anatator.json`; ZIP `.anatator` also referenced | `src/application/services/projectFile.ts`, `src/presentation/components/ProjectFileActions.tsx` | `ProjectFilePayload` with `version`, `videoUrl`, `videoSource`, `locale`, `subtitleTracks`, `subtitleCues`, `nodes` | `src/tests/application/projectFile.test.ts`, `src/tests/e2e/ProductReady.project-io.spec.ts` | Adapter parses this exact payload and preserves unknown fields |
| Annotation model | Box, ellipse, arrow are shipped; broader annotation type enum exists | `src/domain/entities/UDMNode.ts`, `src/domain/entities/AnnotationFactory.ts` | UDM node with `spatial`, `temporal`, `visual`, `extensions.visual` | `src/tests/domain/AnnotationFactory.test.ts`, canvas/tool tests | Normalized annotations are derived from UDM nodes only |
| Canvas/object model | Visual annotation drawing and hit testing | `src/presentation/components/Canvas/*`, `CanvasUtils.ts` | Normalized spatial floats and visual data | `CanvasRenderer.test.tsx`, `canvasHitTest.test.ts` | ChatGPT widget is review-only, not a canvas editor |
| Video source model | Direct URL, YouTube, demo, local file; export blocked for YouTube/browser limits | `src/application/videoSources.ts`, `videoUrlStorage.ts` | `VideoSource` union; local file object URLs are not portable | `src/tests/application/videoSources.test.ts`, `VideoUrlBinding.spec.ts` | Server reports metadata only; no video bytes |
| Subtitles / timed text | Tracks, cues, SRT/VTT import/export | `src/application/stores/subtitleStore.ts`, `src/application/subtitles/subtitleFormats.ts` | `SubtitleTrack`, `SubtitleCue` with locale text and style | `subtitleFormats.test.ts`, `ProjectSubtitlePanel.test.tsx` | Validator checks cue ranges and orphaned cues |
| Timeline | Studio Beta timing editor | `src/presentation/components/StudioTimeline/*`, `timelineUtils.ts` | Annotation clips from node temporal ranges; explicit track nodes possible | `Timeline.test.tsx`, `StudioSmoke.spec.ts` | Lab creates normalized implicit timeline when no track nodes exist |
| Export/import | Project JSON/ZIP, annotation CSV, gated video MP4 | `src/domain/export/shipped.ts`, `src/application/services/projectArchive.ts` | JSON nodes, CSV annotation rows | exporter and project archive tests | Report export is ChatGPT-only and does not mutate Anotator8 |
| AI / connector remnants | Experimental plugins and proxy stub, no product ChatGPT app found | `src/experimental/plugins/*`, `backend_py/app/routers/plugin_proxy.py` | Plugin allowlist/proxy model | plugin registry tests | Do not conflate plugin sandbox with ChatGPT app |

## Architecture Layers

| Module | Responsibility |
| --- | --- |
| `src/server/app.ts` | Create MCP server, register app tools/resource/prompt, serve Streamable HTTP |
| `src/server/anotator8-adapter.ts` | Parse raw project data, normalize domain model, validate known fields, preserve unknowns |
| `src/server/schemas.ts` | Zod input/output schemas for every tool |
| `src/server/tools/*` | Typed read-only tool handlers |
| `src/server/resources/widget-resource.ts` | Register ChatGPT widget resource and CSP |
| `src/widget/*` | Minimal review/control panel |
| `fixtures/*` | Synthetic Anotator8-like project and VTT |
| `tests/*` | Unit, integration, and contract verification |

## Widget Scope

| UI element | Purpose | Backed by tool/data | Not pretending to do |
| --- | --- | --- | --- |
| Metrics row | Show latest annotation/subtitle/warning counts | `structuredContent.stats` from tools | Not a live editor |
| Warnings list | Show latest structured warnings | `structuredContent.warnings` | Not validation beyond server output |
| Focus buttons | Call `create_review_plan` only when `window.openai.callTool` and hidden `_meta.projectData` are present | Apps SDK bridge feature-detected | Not shown when unsupported |
