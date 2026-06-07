# Anotator8 Product Surface

> **Anotator8 repo path:** `C:\Anotator8`
> **Product version:** 24.0.0 (per `package.json` line 3)
> **Source of truth for product:** this doc, verified against REPO_EVIDENCE in `C:\Anotator8\src\`
> **Grep proof:** no `chatgpt|ChatGPT|openai|mcp|MCP` references in `C:\Anotator8\src\**\*.{ts,tsx}` — confirmed by `ripgrep` on 2026-06-07.

## What Anotator8 Is

A browser-based video annotation PWA (Anatator). Three modes: **Visual** (canvas), **Blocks** (list), **Studio (Beta)** (timeline). Three shipped tools: **box**, **ellipse**, **arrow**. Save/Open project to portable JSON. Connected sync (FastAPI + classroom pilot) is experimental. No ChatGPT integration in product.

## Product Surface Map

| Surface | User-visible capability | Source files (REPO_EVIDENCE) | Data model | Runtime/test evidence | Integration relevance |
| --- | --- | --- | --- | --- | --- |
| **Project save/open** | Save project to portable JSON file (`.anatator.json`); Open saved file | `src\application\services\projectFile.ts` | `ProjectFilePayload` with `version`, `videoUrl`, `videoSource`, `locale`, `classroomId`, `classroomName`, `subtitleTracks`, `subtitleCues`, `nodes` | `src\tests\application\projectFile.test.ts`, `src\tests\e2e\ProductReady.project-io.spec.ts` | Adapter parses this exact payload and preserves unknown fields |
| **Annotation model** | Box, ellipse, arrow are shipped; broader annotation type enum exists | `src\domain\entities\UDMNode.ts` lines 28-47, `src\domain\entities\AnnotationFactory.ts` | `UDMNode` with `spatial`, `temporal`, `visual`, `extensions.visual`; `NodeExtensions.visual.shapeType: 'rect' \| 'circle' \| 'polygon' \| 'arrow' \| 'freehand'` | `src\tests\domain\AnnotationFactory.test.ts` | Normalized annotations are derived from UDM nodes only. Lab mirrors 5-shape enum exactly. |
| **Canvas / object model** | Visual annotation drawing and hit testing | `src\presentation\components\Canvas\*`, `CanvasUtils.ts` | Normalized spatial floats (0..1) and visual data | `CanvasRenderer.test.tsx`, `canvasHitTest.test.ts` | Lab widget is read-only, not a canvas editor. |
| **Video source model** | Direct URL, YouTube (5 URL shapes), demo, local file (non-portable blob) | `src\application\videoSources.ts` lines 38-44 | `VideoSource` union: `local-file` (with `objectUrl` blob), `direct-url`, `youtube` (with `videoId`, `startSeconds`), `demo` | `src\tests\application\videoSources.test.ts`, `VideoUrlBinding.spec.ts` | Lab reads metadata only; no video bytes ever enter the server. YouTube 5-pattern inference is mirrored in lab `parseYouTubeVideoId` (REPO_EVIDENCE-backed). |
| **Subtitles / timed text** | Tracks, cues, SRT/VTT import/export | `src\application\stores\subtitleStore.ts`, `src\application\subtitles\subtitleFormats.ts` | `SubtitleTrack` (`id`, `language`, `label`, `visible`, `locked`), `SubtitleCue` (`id`, `trackId`, `startTime`, `endTime`, `text` per locale, optional `style`/`animation`) | `subtitleFormats.test.ts`, `ProjectSubtitlePanel.test.tsx` | Lab validator checks cue ranges and orphaned cues. |
| **Timeline** | Studio Beta timing editor with explicit track nodes possible | `src\presentation\components\StudioTimeline\*`, `timelineUtils.ts` | Annotation clips from node temporal ranges; explicit `type: "track"` UDM nodes group child annotations | `Timeline.test.tsx`, `StudioSmoke.spec.ts` | Lab creates a normalized implicit timeline when no track nodes exist (`IMPLICIT_TIMELINE` warning). |
| **Export / import** | Project JSON, ZIP archive `.anatator`, annotation CSV, gated video MP4 | `src\domain\export\shipped.ts`, `src\application\services\projectArchive.ts` | JSON nodes, CSV annotation rows | exporter tests, project archive tests | Report export is ChatGPT-only and does not mutate Anotator8. |
| **AI / connector remnants** | Experimental plugins (QuickJS sandbox, deferred); proxy stub; no product ChatGPT app | `src\experimental\plugins\*`, `backend_py\app\routers\plugin_proxy.py` | Plugin allowlist/proxy model | plugin registry tests | Do not conflate plugin sandbox with ChatGPT app. |
| **Sync metadata** | Required `SyncMetadata` on every UDM node (serverSeq, localOpId, integrity hash, ed25519 signature) | `src\domain\entities\UDMNode.ts` lines 70-77, `src\domain\entities\foundation.ts` (IntegrityMetadata, GENESIS_INTEGRITY) | Read-only field, validated but not interpreted by ChatGPT | n/a | Lab preserves `sync` in unknown fields; never exposes integrity keys. |
| **Loro CRDT state** | `extensions.visual.loroState` is base64 Loro snapshot (v24.0 GA) | `src\domain\entities\UDMNode.ts` line 98, `src\infrastructure\storage\loroStore.ts` | String, not parsed by lab | n/a | Lab preserves `loroState` in `extensions.visual` as opaque string. |
| **FERPA / COPPA / GDPR** | `isEducationRecord: boolean`, `dataResidency: 'us-east' \| 'eu-central' \| 'us-west' \| 'kz-central'`, `ownerId`, optional `classroomId` | `src\domain\entities\UDMNode.ts` lines 42-47 | Read-only flags | n/a | Lab preserves these fields; does not interpret them. Important for future privacy controls. |

## Subtitle Language Enum

REPO_EVIDENCE: `AppLocale = "en" | "ru" | "kk"` in `src\shared\types.ts`. Mirrored in lab `src\shared\types.ts` line 3.

## Data Residency Enum

`us-east` | `eu-central` | `us-west` | `kz-central` — REPO_EVIDENCE: `src\domain\entities\UDMNode.ts` line 46. Lab preserves the field but does not restrict on it (read-only adapter).

## Project File Name

The actual product uses `.anatator.json` (or `.anatator` ZIP). The lab fixture is named `sample-project.anotator8.json` because the lab is a separate external project. **Do not rename the lab fixture to `.anatator.json`** — that is the product's namespace.

## Unknown Field Preservation

The lab `Anotator8Adapter.collectUnknownFields()` keeps any top-level field on the raw project that is not in `KNOWN_PROJECT_FIELDS` (currently: `version, videoUrl, videoSource, locale, classroomId, classroomName, subtitleTracks, subtitleCues, nodes`). For any future Anotator8 save/open schema bump, the adapter can:
1. Add the new field to `KNOWN_PROJECT_FIELDS` if it should be normalized.
2. Leave it in `unknownFields` if it should be preserved as opaque.

The fixture deliberately includes `futureReviewState` and `_fixture` to prove preservation works.

## Notes For Porting Back Into Anotator8

- `src\domain\entities\UDMNode.ts` is the type-of-truth for UDM nodes; the lab's `src\shared\types.ts` should eventually import from there or from a published schema package.
- `src\application\videoSources.ts` `parseYouTubeVideoId` is the canonical YouTube pattern set; the lab now mirrors its 5 patterns exactly.
- The lab does NOT depend on `loroState`, `SyncMetadata`, or `integrity` keys. If Anotator8 wants these surfaced in ChatGPT review, the adapter must be extended.
- Anotator8 does NOT currently ship a JSON Schema for the project file. The lab's Zod schemas (in `src\server\schemas.ts`) are an external contract that should eventually be replaced by a published Anotator8 schema.
