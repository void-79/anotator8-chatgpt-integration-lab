# Anotator8 x ChatGPT Integration Lab

> **Хочешь просто запустить? → [QUICKSTART.md](QUICKSTART.md)** (3 шага + проверка)
>
> * `npm install && npm run build`
> * `npm run verify` — 4/4 проверок: build, 118 тестов, HTTP smoke, stdio roundtrip
> * Вставь config snippet из QUICKSTART в Claude Desktop / Cursor / любой MCP-клиент

---

External, read-only **universal MCP 2025-06-18** server with an
**OpenAI Apps SDK 2026-01-26** upper layer for ChatGPT. Built
to review Anotator8 project files from any MCP-speaking client —
Claude Desktop, Cursor, Windsurf, Cline, OpenCode, Aider,
Continue, MCP Inspector, **and** ChatGPT.

This repo is intentionally separate from `void-79/Anotator8`; it
does not edit or import Anotator8 runtime code.

**Version:** 0.4.0-rc — **118/118** tests pass across **17** test
files (16 v0.3.0 + 1 new `stdio-transport` integration suite),
smoke **PASS** (HTTP + stdio + OAuth PRM), zero unhandled
rejections. See [REPORT.md](REPORT.md) for the authoritative
current report.

## Two layers, one server

| Layer | What | Used by |
| --- | --- | --- |
| **Universal MCP** (always on) | 8 read-only tools, 1 prompt, 1 HTML resource, Streamable HTTP, stdio, OAuth 2.0 PRM (RFC 9728), Bearer (RFC 6750) | Claude Desktop, Cursor, Windsurf, Cline, OpenCode, Aider, Continue, MCP Inspector, ChatGPT, anything MCP 2025-06-18 |
| **ChatGPT Apps SDK** (upper, opt-in) | Apps host bridge (`ui/initialize` / `tools/call`, `protocolVersion: 2026-01-26`), widget HTML, `_meta.ui.resourceUri` on every tool | ChatGPT Developer Mode, ChatGPT App Store |

Layers are independent. Non-ChatGPT clients ignore the Apps SDK
`_meta` keys harmlessly. ChatGPT uses the upper layer for
widgets, but the protocol underneath is still plain MCP 2025-06-18.

See [docs/MCP_COMPATIBILITY.md](docs/MCP_COMPATIBILITY.md) for
the full client × feature matrix.

## What It Does

- Starts a **Streamable HTTP** MCP server at `/mcp` (MCP 2025-06-18)
  **or** a **stdio** MCP server (selected by `MCP_TRANSPORT=stdio`).
- Registers **eight** read-only Anotator8 review tools, each with
  typed Zod input + output schemas and a `wrapTool()` audit/error
  envelope. All declared `readOnlyHint: true, destructiveHint:
  false, openWorldHint: false`.
- Registers a minimal ChatGPT widget resource
  (`ui://anotator8/review-widget.html`) that uses the **MCP Apps
  host bridge** (Apps SDK 2026-01-26) as the primary path and
  falls back to legacy `window.openai.callTool` if needed.
- Serves **OAuth 2.0 Protected Resource Metadata** (RFC 9728) at
  `/.well-known/oauth-protected-resource[/<path>]` and emits
  `WWW-Authenticate: Bearer resource_metadata="..."` on 401/403
  challenges.
- Normalizes Anotator8 `.anatator.json` project payloads through
  an adapter boundary that preserves unknown top-level project
  fields.
- Mirrors Anotator8's canonical 5-pattern YouTube URL inference
  (REPO_EVIDENCE: `C:\Anotator8\src\application\videoSources.ts`).
- Includes fixtures (synthetic + deterministic near-real
  generator), unit/integration/contract tests, a real HTTP/MCP
  smoke protocol test, an OAuth PRM demo, a stdio demo, security
  notes, porting docs, and a verified prototype audit.
- Zero `child_process` / `exec` / `spawn` calls anywhere in
  `src/server/**`. FS access is bounded to an allowlist of
  fixture paths and widget source files.

## Run

```powershell
npm install
npm run build
npm test            # 118/118
npm run smoke       # PASS (real HTTP roundtrip)
npm run demo:oauth  # OAuth PRM endpoint evidence
npm run demo:stdio  # MCP protocol roundtrip over stdio
npm run dev         # starts HTTP server on MCP_HOST:MCP_PORT (default 127.0.0.1:8787)
npm run inspect     # opens MCP Inspector against the local server
```

Local HTTP endpoint:

```text
http://127.0.0.1:8787/mcp
```

Local stdio entry point (for Claude Desktop, Cursor, etc.):

```text
node dist/server/index.js   # requires MCP_TRANSPORT=stdio in the spawn env
```

For remote ChatGPT Developer Mode, expose the endpoint over HTTPS
and configure `MCP_AUTH_TOKEN`. See
[docs/CHATGPT_APP_SETUP.md](docs/CHATGPT_APP_SETUP.md) for tunnel
options, security notes, and a config example for every common
local MCP client.

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
- [Architecture](docs/ARCHITECTURE.md) — layer split (universal MCP + Apps SDK)
- [MCP Compatibility](docs/MCP_COMPATIBILITY.md) — client × feature matrix
- [Product Surface](docs/PRODUCT_SURFACE.md) — verified Anotator8 data model
- [Prototype Audit](docs/PROTOTYPE_AUDIT.md) — old connector audit
- [Security](docs/SECURITY.md)
- [ChatGPT App Setup](docs/CHATGPT_APP_SETUP.md) — ChatGPT-specific + local clients
- [Tool Contracts](docs/TOOL_CONTRACTS.md)
- [Porting to Anotator8](docs/PORTING_TO_ANOTATOR8.md)
- [Official Docs Research](docs/research/OFFICIAL_DOCS_RESEARCH.md) — Apps SDK + MCP research table
- [Dependency Audit](docs/DEPENDENCY_AUDIT.md) — vitest 2 → 3, blocked on 4
- [ChatGPT App Store](docs/CHATGPT_APP_STORE.md) — submission runbook
- [QA Report](docs/QA_REPORT.md) — SUPERSEDED, kept for historical reference
- [Build Report](docs/BUILD_REPORT.md) — SUPERSEDED, kept for historical reference
