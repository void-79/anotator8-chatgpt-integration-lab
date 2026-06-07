# Official Docs Research

| Source | What it says | Impact on architecture | Risk if ignored |
| --- | --- | --- | --- |
| OpenAI Apps SDK Quickstart | A ChatGPT app can include a web component UI; if no UI is needed, skip UI resource registration and only expose tools. | Lab registers both tools and one optional review widget, but keeps the widget non-editor scope. | Building a fake UI or requiring UI when tool-only operation is enough. |
| OpenAI Apps SDK Reference | `window.openai` exposes tool input/output, hidden response metadata, `callTool`, follow-up messaging, state, display, and file helpers. It says tools with `structuredContent` should declare `outputSchema`. | Widget feature-detects `window.openai.callTool`; all tools declare output schemas. | Broken widget controls, missing schemas, or unsafe assumptions about host APIs. |
| OpenAI Apps SDK Auth | Read-only anonymous mode can be acceptable, but customer-specific data or write actions should authenticate; authenticated MCP servers are expected to use OAuth 2.1 and protected resource metadata. | Local lab supports optional bearer token only for demo; docs mark OAuth 2.1 as required before production/user data. | Treating bearer token/local demo auth as production-ready. |
| OpenAI Apps SDK Testing | Test tool handlers directly, keep fixtures close to MCP code, use MCP Inspector, validate in ChatGPT Developer Mode once HTTPS reachable. | Added unit/integration/contract tests, `npm run smoke`, `npm run inspect`, and setup docs. | Claiming compatibility without protocol/runtime evidence. |
| OpenAI Apps SDK Security & Privacy | Use least privilege, explicit consent, defense in depth; validate server-side; keep audit logs; sandboxed widgets rely on CSP; OAuth and scope checks are expected for external accounts. | Read-only tools, no arbitrary filesystem/shell, CSP with no external domains, redacted audit logging, 10MB input limit. | Data exfiltration, prompt injection impact, unsafe widgets, unreviewed writes. |
| MCP Tools spec 2025-06-18 | Tools expose names, descriptions, input schemas, optional output schemas; structuredContent should match outputSchema; clients should validate; servers must validate inputs and sanitize outputs. | Every tool has explicit zod input/output schema and a structured error shape. | Stringly typed tools and silent best-effort success. |
| MCP Resources spec 2025-06-18 | Resources are app-driven context identified by URI; servers declare resource capability. | Widget is a `ui://` resource, not a project file browser. | Confusing UI resources with arbitrary file/resource access. |
| MCP Prompts spec 2025-06-18 | Prompts are user-controlled templates exposed by the server and discoverable by clients. | Added `review_anotator8_project` prompt as optional guided workflow. | Hiding workflow assumptions in undocumented prose. |
| MCP Streamable HTTP transport | Clients must use `Accept: application/json, text/event-stream`; servers may issue `Mcp-Session-Id`; clients must reuse it on later requests. | Smoke test implements initialize, session id reuse, SSE parsing, tools/list, tools/call. | False positive smoke tests that do not match the real protocol. |

Evidence links:

- OpenAI Apps SDK Quickstart: https://developers.openai.com/apps-sdk/quickstart
- OpenAI Apps SDK Reference: https://developers.openai.com/apps-sdk/reference
- OpenAI Apps SDK Auth: https://developers.openai.com/apps-sdk/build/auth
- OpenAI Apps SDK Testing: https://developers.openai.com/apps-sdk/deploy/testing
- OpenAI Apps SDK Security & Privacy: https://developers.openai.com/apps-sdk/guides/security-privacy
- MCP Tools: https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- MCP Resources: https://modelcontextprotocol.io/specification/2025-06-18/server/resources
- MCP Prompts: https://modelcontextprotocol.io/specification/2025-06-18/server/prompts
- MCP Transports: https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
