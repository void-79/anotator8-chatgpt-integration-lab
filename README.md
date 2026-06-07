# Anotator8 x ChatGPT Integration Lab

External, read-only ChatGPT Apps SDK/MCP integration lab for Anotator8 project review. This repo is intentionally separate from `void-79/Anotator8`; it does not edit or import Anotator8 runtime code.

**Version:** 0.3.0 — **116/116** tests pass across **16** test files, smoke **PASS** (now includes an OAuth discovery check on `/.well-known/oauth-protected-resource/mcp`), zero unhandled rejections. See [REPORT.md](REPORT.md) for the authoritative current report.

## What It Does

- Starts a Streamable HTTP MCP server at `/mcp` (MCP 2025-06-18).
- Registers **eight** read-only Anotator8 review tools, each with typed Zod input + output schemas and a `wrapTool()` audit/error envelope.
- Registers a minimal ChatGPT widget resource (`ui://anotator8/review-widget.html`) that uses the **MCP Apps host bridge** (Apps SDK 2026-01-26) as the primary path and falls back to legacy `window.openai.callTool` if needed.
- Serves **OAuth 2.0 Protected Resource Metadata** (RFC 9728) at `/.well-known/oauth-protected-resource[/<path>]` and emits `WWW-Authenticate: Bearer resource_metadata="..."` on 401/403 challenges.
- Normalizes Anotator8 `.anatator.json` project payloads through an adapter boundary that preserves unknown top-level project fields.
- Mirrors Anotator8's canonical 5-pattern YouTube URL inference (REPO_EVIDENCE: `C:\Anotator8\src\application\videoSources.ts`).
- Includes fixtures, unit/integration/contract tests, a real HTTP/MCP smoke protocol test, security notes, porting docs, and a verified prototype audit.
- Zero `child_process` / `exec` / `spawn` calls anywhere. FS access is bounded to an allowlist of fixture paths and widget source files.

## Run

```powershell
npm install
npm run build
npm test         # 116/116
npm run smoke    # PASS (real HTTP roundtrip)
npm run dev      # starts server on MCP_HOST:MCP_PORT (default 127.0.0.1:8787)
npm run inspect  # opens MCP Inspector against the local server
```

Local endpoint:

```text
http://127.0.0.1:8787/mcp
```

For remote ChatGPT Developer Mode, expose the endpoint over HTTPS and configure `MCP_AUTH_TOKEN`. See [docs/CHATGPT_APP_SETUP.md](docs/CHATGPT_APP_SETUP.md) for tunnel options and security notes.

## Tools

| Tool | Purpose | Read/write |
| --- | --- | --- |
| `list_capabilities` | Show features, limitations, supported fixtures | read |
| `inspect_project` | Normalize source, annotation, subtitle, timeline, warning summary | read |
| `validate_project` | Validate ids, time ranges, subtitle references, source metadata | read |
| `summarize_annotations` | Count actual annotations by type/shape/label/timing | read |
| `find_annotations` | Filter actual annotations by type, label/text, confidence, time | read |
| `suggest_labels` | Identify label review tasks without inventing labels | read |
| `create_review_plan` | Produce manual review checklist | read |
| `export_chatgpt_report` | Return Markdown/JSON report; does not write files | read |

## Fixture

`fixtures/sample-project.anotator8.json` is synthetic but based on Anotator8 24.0.0 project file evidence (`version`, `videoSource`, `subtitleTracks`, `subtitleCues`, `nodes`, `extensions.visual`, `sync`, `isEducationRecord`, `dataResidency`). It intentionally includes one orphan subtitle cue warning and one unknown future field. See [docs/PRODUCT_SURFACE.md](docs/PRODUCT_SURFACE.md) for the full REPO_EVIDENCE-backed surface map.

## Docs

- [Final Report](REPORT.md) — current authoritative status
- [Architecture](docs/ARCHITECTURE.md)
- [Product Surface](docs/PRODUCT_SURFACE.md) — verified Anotator8 data model
- [Prototype Audit](docs/PROTOTYPE_AUDIT.md) — old connector audit
- [Security](docs/SECURITY.md)
- [ChatGPT App Setup](docs/CHATGPT_APP_SETUP.md)
- [Tool Contracts](docs/TOOL_CONTRACTS.md)
- [Porting to Anotator8](docs/PORTING_TO_ANOTATOR8.md)
- [Official Docs Research](docs/research/OFFICIAL_DOCS_RESEARCH.md) — Apps SDK + MCP research table
- [QA Report](docs/QA_REPORT.md) — SUPERSEDED, kept for historical reference
- [Build Report](docs/BUILD_REPORT.md) — SUPERSEDED, kept for historical reference
