# Role 10 — Final Decision Matrix (1-screen summary)

> **role_id:** 10-final-decision-matrix
> **purpose:** Связанная сводка состояния lab v0.4.0 для чтения человеком за 1 экран и для быстрого ответа LLM.
> **canonical_inputs:** `canonical/active-canonical-index.yaml`, all `truth-passport/*.yaml`, all `canonical/decision-record/*.yaml`, `canonical/source-radar.yaml`, `index/GAP_HARVEST.md`
> **canonical_outputs:** Этот Markdown — generated view.
> **generated_from:** все truth passports + gap harvest
> **last_generated:** 2026-06-07
> **coverage_score:** 1.0 (все 7 truth passports учтены; top 5 gaps)
> **what_this_role_can_prove:** Current state за 1 экран
> **what_this_role_cannot_prove:** что состояние не ухудшится
> **related_truth_passports:** все 7
> **related_decisions:** все 3
> **related_gaps:** top 5

## Сводная таблица (человек за 1 экран)

| Object | Type | Current status | Answer ceiling | Release readiness | Weakest link | Source snapshot | Completeness | Safe next step | Forbidden shortcuts |
|---|---|---|---|---|---|---|---|---|---|
| **lab-v0.4.0** | PRODUCT | READY_FOR_DEMO | PARTIAL_EXACT_MARKET | app_review_ready | privacy_gate (NEEDS_DPIA) | LIVE + CAPTURED_UNHASHED | 0.7 | Add OAuth 2.1 AS | "production ready" claim |
| **list_capabilities** | TOOL | IMPLEMENTED | GENERIC_ARCHETYPE | app_review_ready | vehicle_specificity (static) | LIVE | HIGH | Add version field | App Store ready by itself |
| **inspect_project** | TOOL | IMPLEMENTED | PARTIAL_EXACT_MARKET | app_review_ready | privacy_gate (NEEDS_DPIA) | LIVE + CAPTURED_UNHASHED | 0.75 | Redact _meta.projectData | "reads video bytes" |
| **validate_project** | TOOL | IMPLEMENTED | PARTIAL_EXACT_MARKET | app_review_ready | privacy_gate (NEEDS_DPIA) | LIVE + CAPTURED_UNHASHED | 0.75 | Add v25+ rules | "exhaustive" |
| **decision-bridge-strategy** | DECISION | ACCEPTED | APPS_SDK_BRIDGE_LOCAL_ONLY | app_review_ready (with caveat) | APPS_SDK_PLATFORM_ONLY | LIVE | 0.7 | Live ChatGPT e2e | "bridge is e2e verified" |
| **decision-auth-strategy** | DECISION | ACCEPTED | RUNTIME_VERIFIED + RFC_9728_FOUNDATION_ONLY | not_ready (G-01) | release_readiness | LIVE + CAPTURED_UNHASHED | 0.5 | OAuth 2.1 AS | "OAuth 2.1 ready" |
| **decision-no-write-tool-policy** | DECISION | ACCEPTED | CONFIRMED_FOR_PLATFORM | app_review_ready | (intentionally restrictive) | LIVE | HIGH | Reversible patch (post G-01) | "write tools available" |

## Top 5 gaps (по убыванию impact)

1. **G-01 — OAuth 2.1 Authorization Server** — BLOCKING for public App Store submission. Foundation (RFC 9728) shipped; AS missing.
2. **G-02 — Live ChatGPT Developer Mode e2e** — BLOCKING for any "production ChatGPT" claim. Protocol verified, host behavior not.
3. **G-19 — App Store assets (privacy policy, screenshots, support)** — BLOCKING for App Store submission. Maintainer action required.
4. **G-06 — Reverse proxy / rate limiting** — HIGH for any public exposure. Lab has no rate limit.
5. **G-16 — Privacy redaction for real student data** — HIGH for production. Lab preserves fields as opaque, doesn't redact.

## Top 5 next actions (highest impact, lowest cost)

1. **Capture Tier 1 official URLs to CAPTURED_HASHED** — 1-day task. Promotes 12 LOCATOR_ONLY → CAPTURED_HASHED.
2. **Run live ChatGPT Developer Mode e2e** — needs paid account + tunnel. Closes G-02.
3. **Implement OAuth 2.1 AS (or integrate Auth0/Keycloak)** — closes G-01. Multi-week work.
4. **Add 5 more tool-records + 3 more decision-records + 4 more answer fixtures** — extends v0.5.0 to v0.6.0.
5. **Add validators: validate-source-snapshots, validate-no-fake-controls, validate-answer-fixtures** — closes G-20, hardens pipeline.

## Files to read (для onboarding)

```text
1. README.md — обзор lab
2. REPORT.md — текущее состояние (authoritative)
3. docs/AUDIT_AGAINST_DISCOVERY_FIRST_PROMPT_v1.md — 16-секционный audit
4. canonical/active-canonical-index.yaml — manifest v0.5.0
5. truth-passport/lab-v0.4.0.yaml — truth passport лаба
6. roles/10-final-decision-matrix.md — этот файл
7. index/GAP_HARVEST.md — все gaps
8. docs/CHATGPT_APP_STORE.md — submission runbook
```

## Как ИИ должен отвечать по этой матрице

1. **Всегда** начинать non-trivial ответ с truth passport или его пересказа.
2. **Всегда** указывать `current_answer_ceiling` объекта.
3. **Всегда** перечислять `forbidden_shortcuts` для объекта.
4. **Всегда** предлагать `safe_next_step` если `release_readiness` < production-ready.
5. **Никогда** не повышать статус без нового accepted evidence.
6. **Никогда** не путать `PARTIAL_EXACT_MARKET` (Anotator8 v24.0.0 evidence) с `RUNTIME_VERIFIED` (npm run verify) — это разные ceiling уровни.

## Текущая версия v0.5.0 — что НОВОГО vs v0.4.0

- **Новый active canonical index** (canonical/active-canonical-index.yaml)
- **7 truth passports** (lab + 3 tools + 3 decisions)
- **3 tool-records** (list-capabilities, inspect-project, validate-project)
- **3 decision-records** (bridge-strategy, auth-strategy, no-write-tool-policy)
- **4 supporting records** (product-dossier, runtime-record, source-radar, threat-record, regulatory-record, assurance-case-record, official-doc-record, unknown-unknown)
- **10 discovery leads** (index.yaml)
- **2 role views** (1, 3, 6) + this one (10) = 4 of 10
- **2 validators** (validate-canonical.ts, validate-truth-passports.ts)
- **2 index files** (ROLE_MAP, SOURCE_MAP, GAP_HARVEST)
- **0 changes to src/**, **0 changes to tests/**, **0 changes to REPORT.md**, **0 changes to legacy docs**

## Что осталось нерешённым (для v0.6.0+)

- 5 more tool-records (summarize-annotations, find-annotations, suggest-labels, create-review-plan, export-chatgpt-report)
- 3 more decision-records (cors-allowlist, transports, no-shell-exec-policy)
- 4 more answer fixtures (planned)
- 6 more role views (2, 4, 5, 7, 8, 9)
- 3 more validators (validate-source-snapshots, validate-no-fake-controls, validate-answer-fixtures)
- Capture all 12 Tier 1 URLs to CAPTURED_HASHED
- Live ChatGPT e2e (G-02)
- OAuth 2.1 AS (G-01)
- Golden fixture (G-04)

См. `release-report-v0.5.0.md` для полной картины.
