# Anotator8 × ChatGPT MCP Integration Lab

An MCP server that exposes Anotator8 project data as read-only tools for AI assistants, built as an external integration (no changes to Anotator8 itself).

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (optional — server works with defaults)
cp .env.example .env
# Edit .env — set MCP_AUTH_TOKEN for production, or leave empty for local dev.

# 3. Start the server
npm run dev
# → http://127.0.0.1:8787

# 4. Run smoke test
npm run smoke
# → 6/6 checks pass

# 5. Run tests (unit + integration + contract)
npm test
# → 105/105 pass
```

## Architecture

```
src/
  shared/
    types.ts              # All TypeScript types (UDM → Normalized)
  server/
    anotator8-adapter.ts  # Core: load, validate, normalize Anotator8 data
    index.ts              # MCP server with 7 read-only tools
  scripts/
    smoke.ts              # 6-step smoke test
tests/
  unit/
    adapter.test.ts        # 17 test cases
  integration/
    tools.test.ts          # Tool contract tests
fixtures/
  sample-project.anatator8.json  # Demo project (5 annotations)
```

## Tools

| Tool | Description |
|------|-------------|
| `list_capabilities` | Show server capabilities, supported annotation types, subtitle languages |
| `inspect_project` | High-level overview: metadata, counts, video info, warnings |
| `validate_project` | Check project data consistency and structural validity |
| `summarize_annotations` | Generate annotation statistics grouped by type/shape |
| `find_annotations` | Search and filter annotations by type, shape, time range, text |
| `create_review_plan` | Generate a structured manual review checklist |
| `export_chatgpt_report` | Create a portable summary report for use in ChatGPT |

All tools are **read-only** — they never modify project data.

## ChatGPT Developer Mode Setup

1. **Upgrade** to ChatGPT Plus or Pro
2. **Deploy** this server with HTTPS (Cloudflare Tunnel, ngrok, or a VPS)
3. **Update** `.env` with your public URL
4. In ChatGPT, go to **Settings → Developer** → Add MCP Server
5. Enter your server URL (e.g. `https://your-server.example.com`)

> **Note:** ChatGPT may still show a confirmation prompt for any tool call, even with `readOnlyHint: true`. This is expected per the current ChatGPT Developer Mode behavior.

## Project Data Format

The server is **read-only with zero filesystem access** — Anotator8 project JSON is passed
**in tool arguments**, not loaded from disk. The shape is `ProjectFilePayload` (see
`src/shared/types.ts`):

```typescript
{
  version: string;          // e.g. "24.0.0"
  videoUrl?: string;
  videoSource?: { kind: "local-file" | "direct-url" | "youtube" | "demo"; ... };
  locale?: "en" | "ru" | "kk";
  classroomId?: string;
  classroomName?: string;
  subtitleTracks?: SubtitleTrack[];
  subtitleCues?: SubtitleCue[];
  nodes: UDMNode[];         // annotations + shapes
}
```

A complete sample is at `fixtures/sample-project.anotator8.json` (5 annotations, 2 subtitle
tracks, 3 cues, plus a `loroState` future-field to prove unknown-field preservation).

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MCP_HOST` | No | `127.0.0.1` | Host to bind the server to |
| `MCP_PORT` | No | `8787` | Port to listen on |
| `MCP_AUTH_TOKEN` | No | — | Bearer token for API authentication |
| `CORS_ORIGIN` | No | `*` | Allowed CORS origin |

## Development

```bash
npm install        # Install dependencies
npm run dev        # Watch mode with tsx (auto-reload on changes)
npm run build      # Compile TypeScript to dist/
npm run start      # Run production build
npm test           # Unit + integration tests (vitest)
npm run smoke      # Smoke test (6 checks)
```

## Key Design Decisions

- **Adapter-first**: All Anotator8-specific logic lives in `anotator8-adapter.ts`, keeping the MCP server generic
- **Graceful degradation**: Invalid nodes in project files are skipped with warnings rather than failing the whole load
- **Normalized output**: Adapter always returns `Normalized*` types — MCP server never touches raw UDMNode shapes
- **Zero mutations**: Every tool is read-only; the server never writes back to project files
