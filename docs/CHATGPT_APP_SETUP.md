# ChatGPT App Setup

This doc covers the **ChatGPT-specific** setup. The lab is
**first** a universal MCP 2025-06-18 server and **secondly** a
ChatGPT Apps SDK target — see `docs/MCP_COMPATIBILITY.md` for the
client matrix and `docs/ARCHITECTURE.md` for the layer split.

## Two layers, one server

| Layer | Used by | Always on? | Doc |
| --- | --- | --- | --- |
| **Universal MCP** (Streamable HTTP + stdio) | Claude Desktop, Cursor, Windsurf, Cline, OpenCode, Aider, Continue, MCP Inspector, anything else speaking MCP 2025-06-18 | ✅ | This file § Local + § Local clients |
| **ChatGPT Apps SDK** (postMessage bridge, widget HTML, `_meta.ui`) | ChatGPT (Developer Mode + App Store) | ✅ upper layer, harmless to non-ChatGPT clients | This file § ChatGPT Developer Mode |

The two layers are independent. You can use the lab with only the
universal layer (e.g. with Claude Desktop) — the Apps SDK widgets
will be served as plain resources and ignored. Conversely, ChatGPT
uses the Apps SDK upper layer; it still talks MCP 2025-06-18 under
the hood.

## Local

```powershell
npm install
npm run build
npm run dev          # Streamable HTTP on http://127.0.0.1:8787/mcp
npm run demo:stdio   # full MCP protocol roundtrip over stdio
npm run demo:oauth   # live OAuth PRM endpoint evidence
```

For local stdio clients (Claude Desktop, Cursor, Windsurf, Cline,
OpenCode, Aider, Continue, GitHub Copilot in VS Code), point them
at the **built** `dist/server/index.js` with `MCP_TRANSPORT=stdio`.
See **§ Local clients (stdio)** below.

Localhost is useful for MCP Inspector, not direct ChatGPT connection.

## MCP Inspector

```powershell
npm run dev
npm run inspect
```

In Inspector, use:

```json
{ "fixtureId": "sample-project" }
```

for `inspect_project`, `validate_project`, and other fixture-aware tools.

## Local clients (stdio)

The same `dist/server/index.js` is what every local stdio MCP
client spawns. Set `MCP_TRANSPORT=stdio` in the client's config
(most clients merge `env` from the config into the spawn
environment).

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config
.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json`
(Windows):

```json
{
  "mcpServers": {
    "anotator8": {
      "command": "node",
      "args": [
        "C:\\anotator8-chatgpt-integration-lab\\dist\\server\\index.js"
      ],
      "env": { "MCP_TRANSPORT": "stdio" }
    }
  }
}
```

### Cursor / Windsurf / Cline (VS Code) / OpenCode / Continue

Edit `.cursor/mcp.json`, `~/.codeium/windsurf/mcp.json`,
`.vscode/mcp.json`, or equivalent:

```json
{
  "mcpServers": {
    "anotator8": {
      "command": "node",
      "args": [
        "C:\\anotator8-chatgpt-integration-lab\\dist\\server\\index.js"
      ],
      "env": { "MCP_TRANSPORT": "stdio" }
    }
  }
}
```

(Use forward slashes or escaped backslashes per JSON rules; the
example shows the Windows path. On macOS / Linux, replace with
`/Users/...` or `/home/...`.)

### Aider

In `~/.aider.conf.yml`:

```yaml
mcp-servers:
  - name: anotator8
    command: node
    args: ["C:\\anotator8-chatgpt-integration-lab\\dist\\server\\index.js"]
    env:
      MCP_TRANSPORT: stdio
```

### Verification

After restarting the host app, run `npm run demo:stdio` from the
lab to confirm the lab's own stdio transport is healthy, and use
the host app's MCP diagnostic view to confirm the client can
reach the server. `tests/integration/stdio-transport.test.ts`
asserts the same protocol roundtrip end-to-end (spawn, initialize,
tools/list, tools/call).

## ChatGPT Developer Mode

Based on the OpenAI Apps SDK quickstart (Apps bridge protocol version 2026-01-26) and MCP 2025-06-18:

1. Expose the MCP endpoint over HTTPS. Use Cloudflare Tunnel (`cloudflared tunnel --url http://127.0.0.1:8787`), ngrok (`ngrok http 8787`), Secure MCP Tunnel, or a real deployment with a reverse proxy.
2. Set `MCP_AUTH_TOKEN` at minimum for demos. Production needs OAuth 2.1 (see "Production Auth Gap" below).
3. In ChatGPT, enable **Developer Mode** in **Settings → Apps & Connectors → Advanced settings**.
4. **Settings → Connectors → Create** and paste the public URL with `/mcp`, e.g.:

```text
https://your-public-host.example/mcp
```

5. Configure Bearer auth with the same `MCP_AUTH_TOKEN` value.
6. Confirm ChatGPT lists these tools:

```text
list_capabilities
inspect_project
validate_project
summarize_annotations
find_annotations
suggest_labels
create_review_plan
export_chatgpt_report
```

7. Test a golden prompt:

```text
Use the Anotator8 connector. Inspect fixture sample-project, validate it,
summarize annotations, and create a review plan focused on subtitles.
```

## Widget Bridge

The widget uses the **MCP Apps host bridge** (postMessage JSON-RPC, `protocolVersion: "2026-01-26"`) as the primary path. If the host does not support the new bridge, it falls back to the legacy `window.openai.callTool` API (Apps SDK 1.x). A `bridge-info` span in the widget shows which bridge is active (`mcp-apps-host`, `legacy-window.openai`, or `none`).

The bridge is verified in CI by `tests/contract/widget-bridge.test.ts` which asserts on the source of `src/widget/widget.ts`. End-to-end verification needs a paid ChatGPT account.

## Production Auth Gap

The lab ships the OAuth 2.0 Protected Resource Metadata (RFC 9728) foundation in v0.3.0 — `/.well-known/oauth-protected-resource[/<path>]` is served and the 401/403 challenge carries `resource_metadata="..."`. Authorization-server implementation is still a follow-up. Before any real deployment that handles user / customer / student project data:

1. Implement OAuth 2.1 authorization server (token issuance, introspection, JWKS, dynamic client registration).
2. Wire token validation to replace the static `MCP_AUTH_TOKEN` allowlist.
3. Add per-tool scope enforcement (recommended: `mcp:read` for `list_capabilities` / `inspect_project` / `summarize_annotations` / `find_annotations` / `suggest_labels`; `mcp:read` + `mcp:plan` for `create_review_plan`; `mcp:read` + `mcp:export` for `export_chatgpt_report`).
4. Front the public endpoint with a reverse proxy that does rate limiting and (ideally) WAF.
5. Review `docs/SECURITY.md` and `docs/PROTOTYPE_AUDIT.md`.

## OAuth Discovery (RFC 9728)

From v0.3.0, the lab serves its protected-resource metadata at:

```text
GET /.well-known/oauth-protected-resource
GET /.well-known/oauth-protected-resource/mcp
```

A successful response is a JSON document with the `resource` field set to the resource identifier the client used to derive the URL. Configure your public resource identifier via `MCP_OAUTH_RESOURCE` (defaults to `http://${MCP_HOST}:${MCP_PORT}/mcp`). Authorization servers, scopes, and bearer methods are configurable via `MCP_OAUTH_*` env vars — see `.env.example`.

Clients that receive a 401 from `/mcp` will also see the metadata URL in the `WWW-Authenticate` response header (RFC 9728 §5.1), e.g.:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="anotator8-chatgpt-lab",
                  error="invalid_request",
                  resource_metadata="https://your-public-host.example/.well-known/oauth-protected-resource/mcp"
```

## Tunnel Options Compared

| Option | Cost | Setup | Persistence | Notes |
| --- | --- | --- | --- | --- |
| **Cloudflare Tunnel** (`cloudflared`) | Free | `cloudflared tunnel --url http://127.0.0.1:8787` | Ephemeral unless you own a domain | Recommended for demos. |
| **ngrok** | Free tier | `ngrok http 8787` | Ephemeral on free tier | Fast, but URL changes every restart. |
| **Secure MCP Tunnel** | OpenAI-managed | `tunnel-client` CLI | Persistent profile | Documented in prototype README; not verified in this lab. |
| **VPS + nginx + certbot** | $5–10/mo | DNS + certbot + reverse proxy | Permanent | Best for production; needs OAuth. |

