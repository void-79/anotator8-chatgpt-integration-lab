# MCP Client Compatibility Matrix

The lab is built on **MCP 2025-06-18** (universal transport) with the
**OpenAI Apps SDK 2026-01-26** as an opt-in upper layer for ChatGPT
iframe widgets. Every feature degrades cleanly when the client does
not speak a given layer.

## Layer 1 — Universal MCP

Any MCP 2025-06-18 client can:

- Discover the server's `name`, `version`, `capabilities` (tools,
  resources, prompts) via the standard `initialize` handshake.
- List and call all 8 read-only tools with full Zod input/output
  schemas. Every tool is declared `readOnlyHint: true,
  destructiveHint: false, openWorldHint: false`.
- Read the `ui://anotator8/review-widget.html` resource (clients
  that do not render HTML may ignore it; that is fine).
- Use the `review_anotator8_project` prompt template.
- Talk to the server over Streamable HTTP (default) or stdio
  (`MCP_TRANSPORT=stdio`).

In stdio mode the server is also reachable from any local MCP
client that can spawn a process (Claude Desktop, Cursor, Windsurf,
Cline, OpenCode, Aider, Continue, GitHub Copilot in VS Code, etc).

| Client | Transport | Verified | Notes |
| --- | --- | --- | --- |
| Generic MCP 2025-06-18 client | Streamable HTTP | ✅ via `tests/integration/http-mcp-protocol.test.ts` + `npm run smoke` | Standard `initialize`, `tools/list`, `tools/call` over HTTP |
| Generic MCP 2025-06-18 client | stdio | ✅ via `tests/integration/stdio-transport.test.ts` | Spawns `node dist/server/index.js` with `MCP_TRANSPORT=stdio`; full protocol roundtrip |
| `@modelcontextprotocol/sdk` Client + `StdioClientTransport` | stdio | ✅ via `npm run demo:stdio` | Live evidence script |
| MCP Inspector | Streamable HTTP | ✅ via `npm run inspect` | Official OpenAI / Anthropic debug tool |
| Claude Desktop (when used as a local MCP client) | stdio | ⏳ not verified end-to-end on this host (no install) | Config example: see `docs/CHATGPT_APP_SETUP.md` § Local clients |
| Cursor | stdio | ⏳ not verified end-to-end on this host | Config example: see `docs/CHATGPT_APP_SETUP.md` § Local clients |
| Windsurf | stdio | ⏳ not verified end-to-end on this host | Config example: see `docs/CHATGPT_APP_SETUP.md` § Local clients |
| Cline (VS Code) | stdio | ⏳ not verified end-to-end on this host | Config example: see `docs/CHATGPT_APP_SETUP.md` § Local clients |
| OpenCode (this very session) | stdio | ⏳ not verified end-to-end on this host | Same config shape as Cline |
| Aider | stdio | ⏳ not verified end-to-end on this host | Same config shape as Cline |
| Continue (VS Code / JetBrains) | stdio | ⏳ not verified end-to-end on this host | Same config shape as Cline |
| GitHub Copilot in VS Code | stdio | ⏳ not verified end-to-end on this host | Config differs (MCP support is newer) |

The `⏳ not verified end-to-end` rows are real gaps. The protocol
is correct (verified through the `@modelcontextprotocol/sdk`
Client) but no one has wired the lab into those specific
applications on this host. Each one needs a small config file
(`claude_desktop_config.json` / `mcp.json` / `.cursorrules` /
etc.) plus a public tunnel or a local stdio spawn.

## Layer 2 — ChatGPT Apps SDK (upper, opt-in)

The lab also speaks the OpenAI Apps SDK 2026-01-26. ChatGPT
specific behavior:

| Feature | Where | Status |
| --- | --- | --- |
| Apps host bridge (`ui/initialize` + `tools/call`) | `src/widget/widget.ts` | ✅ primary path |
| Legacy `window.openai.callTool` fallback | `src/widget/widget.ts` | ✅ Apps SDK 1.x compat |
| `ui://anotator8/review-widget.html` resource | `src/server/resources/widget-resource.ts` | ✅ served via `resources/read` |
| `_meta.ui.resourceUri` on every tool | `src/server/app.ts` (`registerAppTool`) | ✅ visible to ChatGPT only; ignored by non-ChatGPT clients |
| Focus buttons → `create_review_plan` | `src/widget/widget.ts` | ✅ hidden when no usable bridge (no fake UI) |
| ChatGPT Developer Mode (manual setup) | docs/CHATGPT_APP_SETUP.md | ✅ end-to-end instructions |
| ChatGPT App Store submission | docs/CHATGPT_APP_STORE.md | ✅ submission runbook |
| Live ChatGPT Developer Mode roundtrip | n/a | ⏳ not verified (no paid ChatGPT account + tunnel on this host) |

## Auth posture by transport

| Transport | Auth mechanism | Default |
| --- | --- | --- |
| Streamable HTTP (MCP_TRANSPORT unset or `=http`) | Bearer token via `Authorization: Bearer <token>` (RFC 6750), 401/403 + `WWW-Authenticate` with `resource_metadata=...` (RFC 9728 §5.1) | `MCP_AUTH_TOKEN` is **optional**; unset mode prints a 7-line DEMO-ONLY banner |
| stdio (`MCP_TRANSPORT=stdio`) | OS process boundary; `MCP_AUTH_TOKEN` is **ignored** (no HTTP request to authenticate) | Local trust delegated to the OS user / file permissions |

## What does NOT work yet (honest gaps)

- **No live ChatGPT Developer Mode end-to-end** on this host (no
  paid account, no tunnel client installed). The protocol is
  verified to MCP 2025-06-18 via `npm run smoke` and Apps-bridge
  2026-01-26 via `tests/contract/widget-bridge.test.ts`.
- **No OAuth 2.1 authorization server** is implemented. The lab
  serves the **discovery foundation** (RFC 9728 protected
  resource metadata + dynamic discovery). The static
  `MCP_AUTH_TOKEN` allowlist is still the actual gate.
- **No per-tool scope enforcement**. A future OAuth AS could
  gate `inspect_project`, `validate_project`, etc. by scope.
- **No golden fixture from a real Anotator8 export** (synthetic
  + near-real generated, but not from production data).
- **No load test** with >10k annotations.
- **No reverse proxy / rate limiting** in the lab server. Deploy
  behind a tunnel with a rate limit before public exposure.

## How to add a new MCP client to this matrix

1. Add a row to the matrix with the client name, transport, and
   the config file it expects (`mcp.json`, `claude_desktop_config
   .json`, `.cursor/mcp.json`, etc.).
2. If the client is a local stdio spawner, the config is roughly:

   ```json
   {
     "mcpServers": {
       "anotator8": {
         "command": "node",
         "args": ["C:/anotator8-chatgpt-integration-lab/dist/server/index.js"],
         "env": { "MCP_TRANSPORT": "stdio" }
       }
     }
   }
   ```

   (Path varies by OS; on macOS/Linux it is
   `/Users/.../anotator8-chatgpt-integration-lab/dist/server/
   index.js`.)
3. Run `npm run build` first; the test must verify that
   `dist/server/index.js` exists and the protocol handshake
   succeeds.
4. If the client needs anything beyond MCP 2025-06-18
   (extensions, custom methods), document it here and add a
   contract test under `tests/contract/`.
