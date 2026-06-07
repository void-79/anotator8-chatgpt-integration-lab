# Source Map — все источники lab v0.4.0 / knowledge base v0.5.0

> **Назначение:** единая карта источников (URL, REPO, PROTOTYPE, RUNTIME, INFERENCE) и их snapshot state. Этот файл — read-only справочник. Canonical source radar — в `canonical/source-radar.yaml`.
> **Дата:** 2026-06-07
> **Классификация:** повторяет evidence classification из `docs/ARCHITECTURE.md` (REPO / PROTOTYPE / OFFICIAL_DOC / RUNTIME / INFERENCE / UNCLEAR).

## Tier 1 — OFFICIAL_SPEC (primary, authoritative)

| ID | Title | URL | Snapshot state | Staleness trigger | Используется в |
|---|---|---|---|---|---|
| OFF-MCP-2025-06-18 | MCP Specification 2025-06-18 | https://modelcontextprotocol.io/specification/2025-06-18/ | LOCATOR_ONLY | Новый MCP spec release | `canonical/official-doc-record.yaml` |
| OFF-MCP-ARCH | MCP Architecture overview | https://modelcontextprotocol.io/docs/concepts/architecture | LOCATOR_ONLY | Same as above | `roles/03-protocol-transport-middleware.md` |
| OFF-APPS-SDK-QS | OpenAI Apps SDK Quickstart (2026-01-26) | https://developers.openai.com/apps-sdk/quickstart | LOCATOR_ONLY | Apps SDK bridge protocol version bump | `canonical/official-doc-record.yaml`, `roles/04-open-specs-sdk-api.md` |
| OFF-APPS-SDK-REF | OpenAI Apps SDK Reference | https://developers.openai.com/apps-sdk/reference | LOCATOR_ONLY | Same as above | `docs/research/OFFICIAL_DOCS_RESEARCH.md` |
| OFF-APPS-SDK-AUTH | OpenAI Apps SDK Auth | https://developers.openai.com/apps-sdk/build/auth | LOCATOR_ONLY | Same as above | `docs/CHATGPT_APP_SETUP.md`, `docs/SECURITY.md` |
| OFF-APPS-SDK-SEC | OpenAI Apps SDK Security & Privacy | https://developers.openai.com/apps-sdk/guides/security-privacy | LOCATOR_ONLY | Same as above | `canonical/threat-record.yaml`, `docs/SECURITY.md` |
| OFF-APPS-SDK-TEST | OpenAI Apps SDK Testing | https://developers.openai.com/apps-sdk/deploy/testing | LOCATOR_ONLY | Same as above | `roles/05-testing-verification-mock.md` |
| OFF-APPS-SDK-SUB | OpenAI Apps SDK Submission | https://developers.openai.com/apps-sdk/deploy/submission | LOCATOR_ONLY | Same as above | `docs/CHATGPT_APP_STORE.md` |
| OFF-APPS-SDK-GUIDE | OpenAI Apps SDK Submission Guidelines | https://developers.openai.com/apps-sdk/app-submission-guidelines | LOCATOR_ONLY | Same as above | `docs/CHATGPT_APP_STORE.md` |
| OFF-RFC-9728 | OAuth 2.0 Protected Resource Metadata (RFC 9728) | https://www.rfc-editor.org/rfc/rfc9728 | LOCATOR_ONLY | Errata | `canonical/regulatory-record.yaml`, `src/server/oauth/protected-resource-metadata.ts` |
| OFF-RFC-6750 | OAuth 2.0 Bearer Token Usage (RFC 6750) | https://www.rfc-editor.org/rfc/rfc6750 | LOCATOR_ONLY | Errata | `canonical/regulatory-record.yaml`, `src/server/auth.ts` |
| OFF-RFC-8414 | OAuth 2.0 Authorization Server Metadata (RFC 8414) | https://www.rfc-editor.org/rfc/rfc8414 | LOCATOR_ONLY | Errata | `canonical/regulatory-record.yaml` (AS ref, deferred) |

**Внимание:** все Tier 1 источники находятся в состоянии `LOCATOR_ONLY` — URL указан, но **содержимое не захвачено и не захешировано**. Это означает:
- Любая ссылка — locator, **не evidence**.
- Изменения upstream могут сделать ссылку неактуальной.
- Для промоушена в `CAPTURED_HASHED` нужен реальный snapshot + sha256.

## Tier 2 — PRIMARY (REPO / PROTOTYPE)

| ID | Title | Path | Snapshot state | Используется в |
|---|---|---|---|---|
| REPO-AN8 | Anotator8 v24.0.0 source | `C:\Anotator8` | LIVE | `canonical/product-dossier.yaml` |
| REPO-LAB | Anotator8 ChatGPT Integration Lab v0.4.0 | `C:\anotator8-chatgpt-integration-lab` | LIVE (HEAD = `42906e1`, clean) | Везде |
| REPO-LAB-AUDIT-V1 | Audit against Discovery-First Build Prompt v1 | `docs/AUDIT_AGAINST_DISCOVERY_FIRST_PROMPT_v1.md` | LIVE (untracked) | `index/GAP_HARVEST.md` (наследует gap-list) |
| PROTOTYPE-OLD | Old `C:\chat-gpt-mcp-app` Python FastMCP | `C:\chat-gpt-mcp-app` | LIVE (read-only) | `docs/PROTOTYPE_AUDIT.md` |
| DOCS-LEGACY-BUILD | Stale `docs/BUILD_REPORT.md` | `docs/BUILD_REPORT.md` | SUPERSEDED (header) | `MIGRATION_v0.4.0_to_v0.5.0.md` |
| DOCS-LEGACY-QA | Stale `docs/QA_REPORT.md` | `docs/QA_REPORT.md` | SUPERSEDED (header) | Same |
| DOCS-LEGACY-FINAL | `docs/FINAL_REPORT.md` | `docs/FINAL_REPORT.md` | LIVE (historical, not authoritative) | Same |

## Tier 3 — RUNTIME (build / test / smoke / demo)

| ID | Title | Source | Captured in | Snapshot state | Используется в |
|---|---|---|---|---|---|
| RUNTIME-VERIFY | `npm run verify` output | `scripts/verify.ts` | Live | PASS (4/4: build, test 118/118, smoke, demo:stdio) | `canonical/runtime-record.yaml`, `release-report-v0.5.0.md` |
| RUNTIME-AUDIT | `npm audit --production` | npm | Live | 0 known critical in production deps; 1 dev-only in vitest <4.1.0 (UI server RCE, not used) | `canonical/threat-record.yaml`, `docs/DEPENDENCY_AUDIT.md` |
| RUNTIME-INSPECTOR | `npm run inspect` | npx | Live | Works (`npx @modelcontextprotocol/inspector@latest`) | `docs/CHATGPT_APP_SETUP.md` |
| RUNTIME-CHATGPT-E2E | Live ChatGPT Developer Mode roundtrip | manual | UNTESTED | ⏳ not run on this host (no paid account + tunnel) | `canonical/unknown-unknown.yaml`, `canonical/discovery-lead/real-chatgpt-developer-mode-e2e.yaml` |
| RUNTIME-LOCAL-CLIENTS | Claude Desktop / Cursor / etc. (stdio) | manual | UNTESTED | ⏳ not verified on this host; protocol verified via `npm run demo:stdio` | `docs/MCP_COMPATIBILITY.md` |

## Tier 4 — LEAD_ONLY (community / forum / blog / video)

| ID | Title | URL | Use case | Статус |
|---|---|---|---|---|
| LEAD-OPENAI-COMMUNITY | ChatGPT App Review Process Timelines | https://community.openai.com/t/app-review-process-timelines-for-chatgpt-app-store/1378947 | `docs/CHATGPT_APP_STORE.md` | LEAD_ONLY (cite as community reference, not policy) |
| LEAD-REDDIT-MCP | "My experience submitting my first ChatGPT app" (r/mcp) | https://www.reddit.com/r/mcp/comments/1ps1sr5/ | Same | LEAD_ONLY |
| LEAD-MEDIUM-CHATGPT-APP | "How to submit your app to ChatGPT and actually get it approved" | https://medium.com/techtrends-digest/... | Same | LEAD_ONLY |
| LEAD-GHSA-VITEST | vitest UI server RCE GHSA-5xrq-8626-4rwp | https://github.com/advisories/GHSA-5xrq-8626-4rwp | `docs/DEPENDENCY_AUDIT.md` | RISK_CONTEXT_ONLY (not exploitation guidance) |
| LEAD-GHSA-VITE | vite path traversal GHSA-4w7w-66w2-5vf9 | https://github.com/advisories/GHSA-4w7w-66w2-5vf9 | Same | RISK_CONTEXT_ONLY |
| LEAD-GHSA-ESBUILD | esbuild dev server GHSA-67mh-4wv8-2f99 | https://github.com/advisories/GHSA-67mh-4wv8-2f99 | Same | RISK_CONTEXT_ONLY |
| LEAD-ROLLDOWN-ISSUE | rolldown Windows binding | https://github.com/rolldown/rolldown/issues | `docs/DEPENDENCY_AUDIT.md` | RISK_CONTEXT_ONLY |

## Snapshot state enum (mirror из системного промпта)

```text
MISSING_CAPTURE         URL не известен
LOCATOR_ONLY            URL есть, capture нет
WEB_CHECKED_LOCATOR_ONLY Web search hit, не fetched
CAPTURED_UNHASHED       Fetched, sha256 не считан
CAPTURED_HASHED         Fetched + sha256 + reviewer
REVIEWED_ACCEPTED       Reviewed и принят как evidence
REVIEWED_REJECTED       Reviewed и отвергнут (например, противоречит Tier 1)
STALE                   >staleness_trigger
CONFLICTING             Противоречит другому accepted source
```

## Текущее состояние (на 2026-06-07)

| Bucket | Count |
|---|---|
| `OFFICIAL_SPEC` (Tier 1) | 12 entries, all `LOCATOR_ONLY` |
| `PRIMARY` (Tier 2) | 7 entries, all `LIVE` |
| `RUNTIME` (Tier 3) | 5 entries (4 PASS, 1 UNTESTED) |
| `LEAD_ONLY` (Tier 4) | 7 entries (4 community, 3 risk) |
| `CAPTURED_HASHED` (любой tier) | **0** (пока ни один URL не захвачен с hash) |

**Вывод:** lab v0.4.0 сильно зависит от `LOCATOR_ONLY` Tier 1. Это известный gap. См. `canonical/source-radar.yaml` и `canonical/discovery-lead/` для плана перевода в `CAPTURED_HASHED`.
