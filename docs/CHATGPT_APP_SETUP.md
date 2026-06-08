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

The lab ships the **OAuth 2.1 Authorization Server foundation** in v0.7.0 — a minimal in-process AS that mints RS256 JWT access tokens and supports PKCE S256, DCR, and CIMD. From v0.9.0, the AS **also issues refresh tokens** alongside access tokens (single-use rotation, family revocation, hash-only storage — see [OAUTH_AS.md § v0.9.0](./OAUTH_AS.md#v090--refresh-tokens-rfc-6749--6--104)). In `MCP_OAUTH_MODE=external`, refresh tokens are issued by the IdP (the lab does not issue them itself).

In v0.7.0 the AS is **always on** for discovery, but auth is **opt-in** (`MCP_OAUTH_REQUIRE_AUTH=true` to require it for all tools). Before any real deployment that handles user / customer / student project data:

1. Cut over to a production IdP (Auth0 / Okta / Cognito / Stytch) using the [cutover recipe in OAUTH_AS.md](./OAUTH_AS.md#cutover-recipe-production-idp).
2. Front the public endpoint with a reverse proxy that does rate limiting and (ideally) WAF.
3. Set `MCP_OAUTH_REQUIRE_AUTH=true` once the IdP is in place.
4. Configure per-tool scopes (`MCP_OAUTH_TOOL_SCHEMES_JSON`) for fine-grained access.
5. Review `docs/SECURITY.md` and `docs/PROTOTYPE_AUDIT.md`.
6. (v0.9.0+) Decide a refresh-token TTL. `MCP_OAUTH_REFRESH_TTL_SECONDS` defaults to 30 days; tune per your IdP's session policy.

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

## OAuth 2.1 Authorization Server (RFC 8414) — added in v0.7.0

From v0.7.0, the lab also serves the **Authorization Server** well-known documents and the AS endpoints needed to issue JWT access tokens:

```text
GET  /.well-known/oauth-authorization-server   (RFC 8414 §3)
GET  /.well-known/openid-configuration         (OIDC Discovery §4)
GET  /oauth/jwks.json                          (RFC 7517 JWKS)
GET  /oauth2/v1/authorize                      (RFC 6749 §4.1.1)
POST /oauth2/v1/authorize                      (consent decision)
POST /oauth2/v1/token                          (RFC 6749 §4.1.3)
POST /oauth2/v1/register                       (RFC 7591 DCR)
```

The AS is **always on for discovery**, but auth is **opt-in** for the `/mcp` endpoint. To require auth on every tool call, set `MCP_OAUTH_REQUIRE_AUTH=true`. To require auth on specific tools only, use `MCP_OAUTH_TOOL_SCHEMES_JSON` (per-tool JSON of security schemes).

To exercise the full flow end-to-end without a browser or external IdP:

```bash
npm run demo:oauth
```

The script registers a client, runs the PKCE S256 authorization-code flow, calls `/mcp` with the resulting JWT, and verifies single-use code enforcement and PKCE-mismatch rejection. See [OAUTH_AS.md](./OAUTH_AS.md) for the design, configuration reference, and the cutover recipe for production IdPs.

## Tunnel Options Compared

| Option | Cost | Setup | Persistence | Notes |
| --- | --- | --- | --- | --- |
| **Cloudflare Tunnel** (`cloudflared`) | Free | `cloudflared tunnel --url http://127.0.0.1:8787` | Ephemeral unless you own a domain | Recommended for demos. |
| **ngrok** | Free tier | `ngrok http 8787` | Ephemeral on free tier | Fast, but URL changes every restart. |
| **Secure MCP Tunnel** | OpenAI-managed | `tunnel-client` CLI | Persistent profile | Documented in prototype README; not verified in this lab. |
| **VPS + nginx + certbot** | $5–10/mo | DNS + certbot + reverse proxy | Permanent | Best for production; needs OAuth. |

## Headless MCP Inspector Smoke (CI-friendly, added in v0.6.0)

`npm run inspect` opens the interactive MCP Inspector UI in a browser — that requires a workstation with a display. For CI hosts (or for any local check where you don't want to spawn a browser), use the headless equivalent:

```powershell
npm run verify:dev
```

It boots the same HTTP MCP app the Inspector would point at, drives the Streamable HTTP transport with the same five steps a manual Inspector session performs:

1. `initialize` (asserts `serverInfo.name` matches the lab name)
2. `notifications/initialized` (asserts 200 or 202 per MCP 2025-06-18)
3. `tools/list` (asserts all 8 expected tools are present and all declare `readOnlyHint: true`)
4. `tools/call` of `inspect_project` on the `sample-project` fixture (asserts `ok: true`)
5. `resources/list` (asserts the widget HTML is reachable at `ui://anotator8/review-widget.html`)

It clears `MCP_AUTH_TOKEN` for its own process, so it works in local demo mode (no Bearer header) — matching what the interactive Inspector does when pointed at a localhost server. The script is included in `npm run verify` (now 7/7) so every CI run also gets this proof.

If `verify:dev` fails but `smoke` passes, the most likely cause is a recent change to a tool's `annotations` block (the headless script asserts `readOnlyHint: true` for every registered tool).

