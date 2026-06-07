# Anotator8 x ChatGPT Integration Lab

External, read-only ChatGPT Apps SDK/MCP integration lab for Anotator8 project review. This repo is intentionally separate from `void-79/Anotator8`; it does not edit or import Anotator8 runtime code.

## What It Does

- Starts a Streamable HTTP MCP server at `/mcp`.
- Registers eight read-only Anotator8 review tools.
- Registers a minimal ChatGPT widget resource for project summary and warnings.
- Normalizes Anotator8 `.anatator.json` project payloads through an adapter boundary.
- Preserves unknown top-level project fields.
- Includes fixtures, unit/integration/contract tests, smoke protocol test, security notes, and porting docs.

## Run

```powershell
npm install
npm run build
npm test
npm run smoke
npm run dev
```

Local endpoint:

```text
http://127.0.0.1:8787/mcp
```

For remote ChatGPT Developer Mode, expose the endpoint over HTTPS and configure `MCP_AUTH_TOKEN`.

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

`fixtures/sample-project.anotator8.json` is synthetic but based on Anotator8 24.0.0 project file evidence (`version`, `videoSource`, `subtitleTracks`, `subtitleCues`, `nodes`). It intentionally includes one orphan subtitle cue warning and one unknown future field.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Security](docs/SECURITY.md)
- [ChatGPT App Setup](docs/CHATGPT_APP_SETUP.md)
- [Tool Contracts](docs/TOOL_CONTRACTS.md)
- [Porting to Anotator8](docs/PORTING_TO_ANOTATOR8.md)
- [QA Report](docs/QA_REPORT.md)
