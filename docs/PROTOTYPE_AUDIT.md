# Old Prototype Connector Audit

> **Old prototype:** `C:\chat-gpt-mcp-app` — Python 3.14, FastMCP, designed as a local dev helper.
> **Status:** inspected read-only, NOT copied. Used as a reference for ideas only.

## Summary Verdict

The prototype is a **local coding helper** (git status, file reads, search, predefined profile runner). It is **not** a ChatGPT app integration, **not** an Anotator8 domain connector, and **not** suitable as a starting point for a product-facing integration. It can inspire sandbox ideas and tool-naming discipline, but it must not be ported as-is.

## Audit Table

| Area | What exists | Useful idea | Not reusable / unsafe | Evidence |
| --- | --- | --- | --- | --- |
| **Framework** | Python `FastMCP` from `mcp>=1.26`, streamable HTTP transport | Naming discipline (snake_case tools, descriptions, READ_ONLY/WRITE annotations) | Not a ChatGPT App UI; no `@modelcontextprotocol/ext-apps`; not Anotator8-aware | `src\dev_mcp\server.py` lines 1-30 |
| **Tool list** | `list_profiles`, `get_git_status`, `get_git_diff`, `get_git_log`, `read_file`, `list_files`, `search_code`, `run_profile`, `get_project_info` | Profile-allowlist concept; READ_ONLY vs WRITE annotations | None of these tools are Anotator8-specific. `run_profile` is a write tool in a coding-helper context; we don't want a `run_profile` analog in our lab. | `src\dev_mcp\server.py` lines 51-189 |
| **Path guard** | `PermissionGuard` keeps paths inside `DEV_MCP_PROJECT_ROOT`; blocks `node_modules`, `.venv`, `__pycache__`; blocks `.env`, `id_rsa`, `credentials.json`, `*.pem` | Allowlist-by-path pattern | Product integration should not expose `read_file`/`list_files`/`search_code` at all; ChatGPT should receive normalized data, not raw FS access | `src\dev_mcp\permissions.py`, `src\dev_mcp\config.py:96-119` |
| **Command model** | `run_profile` executes named profiles only, from `config.yaml`; no arbitrary shell | Predefined-profile allowlist, command timeout, max output bytes | `run_profile` is a "write" tool that runs `python -m pytest` and `python -m ruff check` — wrong abstraction for our use case | `src\dev_mcp\config.py:57-93`, `src\dev_mcp\adapters\runner.py` |
| **Audit** | `log_tool_call` writes JSONL with tool name, args summary, and result summary | Stderr-friendly audit log with redaction | No PII / project-content policy. No redaction of bearer tokens. | `src\dev_mcp\audit.py` |
| **Auth** | Optional `DEV_MCP_API_KEY` env var; if unset, prints a warning but does not block | "API key optional" UX for local dev | No OAuth 2.1; no per-tool scope; no CSRF protection on the streamable HTTP route | `src\dev_mcp\server.py:208-213`, `src\dev_mcp\config.py:35` |
| **Tool schemas** | Python functions with `description` and `annotations`; **no typed output schemas** | Forced `description` strings per tool | Missing output schemas — caller must infer structure from prose. No validation of tool output. | `src\dev_mcp\server.py:51-189` |
| **App UI / widget** | None. Pure tool surface. | None. | No resource registration, no UI, no Apps SDK. | n/a |
| **Anotator8 domain model** | None. | None. | The prototype has no awareness of `UDMNode`, `videoSource`, `subtitleTracks`, project save/open. | n/a |
| **CORS** | Default FastMCP, `cors: *` in examples; not hardened for ChatGPT | Origin allowlist is a known requirement | Default `*` CORS is wrong for production. | FastMCP defaults |
| **CORS preflight** | Not handled in our required paths | Need explicit `OPTIONS` handling for `/mcp` and nested routes (e.g. `/mcp/actions`) | Without it ChatGPT's connector wizard surfaces 502 errors. | OpenAI Apps SDK quickstart |
| **State management** | Stateless HTTP | None | Stateless is fine for our case, but we need correct session ID handling if we add state. | `server.py:38-45` |
| **Lifecycle / spec version** | No `protocolVersion` declared in initialize | Must declare `2025-06-18` (or newer) | Non-conformant MCP servers are rejected by clients. | MCP spec |
| **Streamable HTTP transport** | Uses `transport="streamable-http"` | Correct transport | n/a | `server.py:219` |
| **Security: arbitrary shell** | None — no `run_shell` analog | n/a | n/a | `server.py:1-189` |
| **Security: secret reading** | Path guard blocks `.env`, `id_rsa`, `credentials.json`, `*.pem` | Defensive deny list | Defense in depth — we add explicit fixture allowlist in lab | `permissions.py:43-48`, `config.py:104-109` |

## What the Lab Reused vs Dropped

| Prototype idea | Reused? | Why |
| --- | --- | --- |
| `PermissionGuard`-style path allowlist | YES (improved) | Lab `storage.ts` only reads from an allowlist of fixture paths inside the lab itself. No `read_file` tool at all. |
| `ToolAnnotations(readOnlyHint=True)` pattern | YES | Every lab tool is registered with `readOnlyHint: true, destructiveHint: false, openWorldHint: false`. |
| Bearer auth with `MCP_AUTH_TOKEN` (or `DEV_MCP_API_KEY`) | YES (improved) | Same idea, but the lab adds RFC 6750 `WWW-Authenticate` header and a screaming demo-mode warning. |
| Stderr audit log | YES (improved) | Lab's `audit()` adds Bearer-token + `MCP_AUTH_TOKEN=` redaction and 500-char summary cap. |
| `run_profile` command runner | NO | Product integration should not run shell commands at all. Write tools must be patch/proposal based, not shell invocations. |
| `read_file` / `list_files` / `search_code` | NO | ChatGPT should receive normalized project data, not arbitrary file access. |
| FastMCP framework | NO | Lab uses TypeScript for portability to Anotator8. |
| Default `*` CORS | NO | Lab defaults to `chatgpt.com` + `chat.openai.com` allowlist, plus `CORS_ORIGIN` for additional. |
| No output schema | NO | Every lab tool has a Zod `outputSchema` declared in `registerAppTool`. |
| `config.yaml` profile loading | NO | Lab uses env vars + a static `config/capabilities.example.json` template. |
| JSONL audit | NO | Lab uses stderr JSON lines via `process.stderr.write` for portability with vitest output. |

## Final Verdict

**Do not import the prototype.** Treat it as a checklist of "what local dev tools usually need" and an inspiration for the security patterns. Build the lab from scratch against the Anotator8 domain and the Apps SDK spec — which is what the lab does.
