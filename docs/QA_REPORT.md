# QA Report

## Official Docs Research

See `docs/research/OFFICIAL_DOCS_RESEARCH.md`.

## Prototype Connector Audit

| Area | What exists | Useful idea | Not reusable / unsafe | Evidence |
| --- | --- | --- | --- | --- |
| Framework | Python `FastMCP` local dev MCP server | Named MCP tools and streamable HTTP local server | Not a ChatGPT App UI or Anotator8 domain connector | `C:\chat-gpt-mcp-app\src\dev_mcp\server.py` |
| Path guard | `PermissionGuard` keeps paths in project root and blocks secret-like names | Keep allowlist mindset | Product integration should not expose broad read_file/list_files | `permissions.py`, `files_adapter.py` |
| Command model | `run_profile` executes named profiles only | No arbitrary shell; profile allowlist concept | Still a local coding helper, not Anotator8 project review | `config.example.yaml`, `runner.py` |
| Audit | JSONL tool-call logging | Keep audit events and redaction | Needs PII policy for real project data | `audit.py` |
| Auth | Optional API key warning | Auth must exist for public exposure | No official OAuth 2.1 flow | `.env.example`, `README.md` |
| Tool schemas | Python functions, limited output contracts | Useful rough tool naming discipline | Missing typed output schemas and app widget | `server.py` |

## Tool Contracts

See `docs/TOOL_CONTRACTS.md`.

## Verification

| Check | Command/method | Result | Evidence |
| --- | --- | --- | --- |
| TypeScript build | `npm run build` | PASS | `tsc` exit 0 |
| Unit/integration/contract tests | `npm test` | PASS | 8 files, 14 tests |
| MCP protocol smoke | `npm run smoke` | PASS | initialize, tools/list, inspect, report |
| MCP Inspector available | `npx -y @modelcontextprotocol/inspector@latest --help` | PASS | help text printed |
| Anotator8 repo unchanged | `git status --short` in `C:\Anotator8` | Existing dirty files only, no lab edits | No integration files added to Anotator8 |

## Verification Output

```text
> anotator8-chatgpt-integration-lab@0.2.0 build
> tsc

> anotator8-chatgpt-integration-lab@0.2.0 test
> vitest run

Test Files  8 passed (8)
Tests       14 passed (14)

> anotator8-chatgpt-integration-lab@0.2.0 smoke
> tsx scripts/smoke.ts

SMOKE PASS
fixture bytes=4638
adapter annotations=3 unknownFields=2
validation valid=true warnings=1
server url=http://127.0.0.1:50976/mcp
initialize session=bc48bbba-2511-41d8-936c-b354dbc9a66c
tools=list_capabilities,inspect_project,validate_project,summarize_annotations,find_annotations,suggest_labels,create_review_plan,export_chatgpt_report
inspect={"annotationCount":3,"annotationTypes":{"box":1,"ellipse":1,"arrow":1},"shapeTypes":{"rect":1,"circle":1,"arrow":1},"subtitleTrackCount":1,"subtitleCueCount":1,"timelineTrackCount":2,"warningCount":1,"unknownFieldCount":2}
report chars=639
```

## Required Deliverables

| Deliverable | Status |
| --- | --- |
| Working external integration lab | YES |
| MCP/App server code | YES |
| Tool implementations | YES |
| Input/output schemas | YES |
| Adapter for Anotator8 project data | YES |
| Fixtures | YES |
| Tests | YES |
| Smoke script | YES |
| ChatGPT widget | YES, minimal review panel |
| Setup docs | YES |
| Security docs | YES |
| Porting guide | YES |
| QA report | YES |

## Remaining Risks

- ChatGPT Developer Mode connection was not run because no HTTPS tunnel/ChatGPT account state was configured in this environment.
- OAuth 2.1 production auth is documented but not implemented.
- npm audit reports 5 vulnerabilities in dependency tree; review required before production.
- Fixture is synthetic; next step is golden fixtures exported from real Anotator8 UI.
