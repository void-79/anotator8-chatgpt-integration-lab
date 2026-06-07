# ChatGPT App Setup

## Local

```powershell
npm install
npm run dev
```

Local MCP endpoint:

```text
http://127.0.0.1:8787/mcp
```

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

