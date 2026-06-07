# Gap Harvest — собранные gaps, unknown unknowns, и сомнения

> **Назначение:** превратить все «не знаю», «сомнительно», «не проверено» из существующих docs в явные gap-records. Этот файл — read-only справочник (curated); canonical gap records — в `canonical/unknown-unknown.yaml` и per-object entries в `truth-passport/*.yaml`.
> **Дата:** 2026-06-07
> **Источники:** `REPORT.md` § Honest gap list, `docs/CHATGPT_APP_SETUP.md` § Production Auth Gap, `docs/CHATGPT_APP_STORE.md` § [GAP] items, `docs/DEPENDENCY_AUDIT.md`, `docs/AUDIT_AGAINST_DISCOVERY_FIRST_PROMPT_v1.md` § Honest remaining work.

## Категории gaps

| Категория | Severity | Что это | Где живёт |
|---|---|---|---|
| `evidence_gap` | high | Нет captured artifact для важного claim | `truth-passport/<obj>.yaml` § evidence_status |
| `runtime_gap` | high | RUNTIME-проверка не пройдена | `canonical/discovery-lead/*.yaml` |
| `unknown_unknown` | medium | Возможно, вопрос даже не задан | `canonical/unknown-unknown.yaml` |
| `safety_gap` | high | Безопасный путь не закрыт, есть обходной | `canonical/threat-record.yaml` |
| `privacy_gap` | high | FERPA/COPPA/GDPR контроль не доказан | `canonical/regulatory-record.yaml` |
| `regulatory_gap` | high | RFC/Apps SDK требование не реализовано | `canonical/regulatory-record.yaml` |
| `tool_gap` | medium | Tool отсутствует или не дотягивает до Apps SDK | `canonical/tool-record/*.yaml` § limitations |
| `process_gap` | low | CI/validator pipeline не покрывает | `release-report-v0.5.0.md` § unresolved_gaps |

## Топ-20 gaps (по убыванию impact)

### G-01 — OAuth 2.1 Authorization Server не реализован
- **Категория:** regulatory_gap + evidence_gap
- **Severity:** BLOCKING для App Store public submission
- **Свидетельство:** `REPORT.md:312-323`, `docs/CHATGPT_APP_SETUP.md:165-173`, `docs/CHATGPT_APP_STORE.md:66`
- **Текущее состояние:** `RFC 9728` PRM foundation shipped (v0.3.0); AS endpoints (token issuance, introspection, JWKS, DCR, token rotation) — not implemented. `MCP_AUTH_TOKEN` static allowlist — actual gate.
- **Что НЕ доказано:** «lab is App Store ready» — false; «lab is OAuth 2.1 ready» — false.
- **Safe next step:** см. `canonical/discovery-lead/oauth-2.1-as-ref-impl.yaml`
- **Нельзя утверждать:** «Bearer + RFC 9728 PRM = OAuth 2.1 ready» — ложь, см. answer fixture `fixtures/answer/rfc-9728-vs-as.md`

### G-02 — Live ChatGPT Developer Mode E2E не выполнен на этом хосте
- **Категория:** runtime_gap + evidence_gap
- **Severity:** BLOCKING для production claim
- **Свидетельство:** `REPORT.md:268-269`, `REPORT.md:315`, `docs/MCP_COMPATIBILITY.md:63, 73-77`
- **Текущее состояние:** protocol verified (smoke + demo:stdio + contract tests); Apps-bridge 2026-01-26 verified (widget-bridge.test.ts); RFC 9728 verified (protected-resource.test.ts). **Но:** no paid ChatGPT account + no tunnel client on this host = no real ChatGPT e2e.
- **Что НЕ доказано:** «lab works in real ChatGPT» — непроверено.
- **Safe next step:** см. `canonical/discovery-lead/real-chatgpt-developer-mode-e2e.yaml`
- **Нельзя утверждать:** «lab is ChatGPT e2e verified» — ложь.

### G-03 — vitest 4.x upgrade path blocked (rolldown Windows App Control)
- **Категория:** evidence_gap (для `npm audit` чистоты)
- **Severity:** medium
- **Свидетельство:** `docs/DEPENDENCY_AUDIT.md:37-72`
- **Текущее состояние:** 1 critical остаётся в devDep `vitest <4.1.0` (UI server RCE, не используется лабой).
- **Safe next step:** см. `canonical/discovery-lead/vitest-4-rolldown-windows.yaml`

### G-04 — Нет golden fixture от реального Anotator8 export
- **Категория:** evidence_gap
- **Severity:** medium
- **Свидетельство:** `REPORT.md:318`, `docs/CHATGPT_APP_STORE.md:46-49` (asset list)
- **Текущее состояние:** synthetic + deterministic near-real fixture (24 annotations, 3 tracks, 18 cues). НЕ из production data.
- **Что НЕ доказано:** «lab handles real-world Anotator8 edge cases».
- **Safe next step:** см. `canonical/discovery-lead/golden-anotator8-fixture.yaml`

### G-05 — Нет load test >10k annotations
- **Категория:** evidence_gap
- **Severity:** low
- **Свидетельство:** `REPORT.md:317`
- **Текущее состояние:** adapter O(n) on nodes; report gen может упереться в string length limit.
- **Safe next step:** см. `canonical/discovery-lead/load-test-10k-annotations.yaml`

### G-06 — Нет reverse proxy / rate limiting
- **Категория:** safety_gap + process_gap
- **Severity:** HIGH для public exposure
- **Свидетельство:** `REPORT.md:319`, `docs/CHATGPT_APP_SETUP.md:172`
- **Safe next step:** см. `canonical/discovery-lead/reverse-proxy-mcp.yaml`

### G-07 — Per-tool scope enforcement не реализован
- **Категория:** regulatory_gap
- **Severity:** medium (post-OAuth-2.1-AS)
- **Свидетельство:** `REPORT.md:316`, `docs/CHATGPT_APP_SETUP.md:171` (recommended scope vocabulary exists)
- **Safe next step:** depends on G-01.

### G-08 — Production deps: `npm audit` 0 known critical, но не проверено заново после каждого install
- **Категория:** process_gap
- **Severity:** low
- **Safe next step:** CI step `npm audit --omit=dev` уже в `.github/workflows/ci.yml` (per REPORT § Phase 2). Проверить выполнение.

### G-09 — MCP SDK 1.29.0 + ext-apps 1.7.4 recursion bug — workaround in place
- **Категория:** evidence_gap (recursion не fatal, но upstream bug)
- **Severity:** low (только чистота test output)
- **Свидетельство:** `REPORT.md:316`, `src/server/app.ts:22-41`
- **Safe next step:** см. `canonical/discovery-lead/mcp-sdk-1.30.yaml`

### G-10 — Cloudflare Tunnel / ngrok recipes не проверены в этом окружении
- **Категория:** runtime_gap
- **Severity:** medium
- **Safe next step:** см. `canonical/discovery-lead/cloudflare-tunnel-mcp.yaml`

### G-11 — Write tools (`propose_annotation_changes`, `apply_annotation_patch`, и т.д.) намеренно deferred
- **Категория:** process_gap (явное решение)
- **Severity:** N/A (intentional)
- **Свидетельство:** `config/capabilities.example.json:15-20`, `docs/SECURITY.md:34-37`
- **Что НЕ доказано:** «lab has write support» — false by design.
- **Safe next step:** requires OAuth 2.1 AS + reversal model. См. `canonical/decision-record/no-write-tool-policy.yaml`.

### G-12 — `readOnlyHint: true` не доказывает zero data exposure
- **Категория:** safety_gap
- **Severity:** medium
- **Свидетельство:** `docs/SECURITY.md:25-28` (widget получает `_meta.projectData`), `src/widget/widget.ts:38`
- **Что НЕ доказано:** «lab не раскрывает проект в widget hidden metadata».
- **Safe next step:** docs note + redact `_meta.projectData` для production.

### G-13 — Apps SDK bridge «mcp-apps-host» не доказывает real ChatGPT e2e
- **Категория:** evidence_gap
- **Severity:** medium
- **Safe next step:** связано с G-02.

### G-14 — Apps SDK post-2026-01-26 не отслежено
- **Категория:** evidence_gap (future)
- **Severity:** low (forward-looking)
- **Safe next step:** см. `canonical/discovery-lead/apps-sdk-post-2026-01-26.yaml`

### G-15 — `MCP_AUTH_TOKEN` unset = открытый сервер (для public tunnel) — footgun
- **Категория:** safety_gap
- **Severity:** HIGH если запустить на public tunnel
- **Свидетельство:** `src/server/index.ts:65-76` (7-line DEMO banner), `docs/SECURITY.md:5-17`
- **Mitigation:** DEMO banner; docs; tunnel setup guide. Не структурно, но семантически.
- **Safe next step:** N/A (by design), но maintainer должен всегда ставить token перед tunnel.

### G-16 — Real Anotator8 проект нельзя загружать в lab без redaction (FERPA/COPPA/GDPR)
- **Категория:** privacy_gap
- **Severity:** HIGH для production
- **Свидетельство:** `docs/PRODUCT_SURFACE.md:26`, `docs/SECURITY.md:21-23, 70-72`
- **Что НЕ доказано:** «lab privacy-safe for student data by default».
- **Safe next step:** redact `isEducationRecord`, `dataResidency`, `ownerId`, `classroomId` перед отдачей в widget. Lab НЕ интерпретирует их, но и НЕ редактирует.

### G-17 — Local stdio clients (Claude Desktop, Cursor, Windsurf, Cline, OpenCode, Aider, Continue, Copilot) — protocol verified, end-to-end на хосте нет
- **Категория:** runtime_gap
- **Severity:** medium
- **Свидетельство:** `docs/MCP_COMPATIBILITY.md:33-41`
- **Safe next step:** maintainer wires each client; protocol уже verified через `npm run demo:stdio`.

### G-18 — Browser availability для Playwright / visual tests не подтверждена
- **Категория:** evidence_gap
- **Severity:** low
- **Свидетельство:** `docs/ARCHITECTURE.md:16`
- **Safe next step:** install Playwright / use MCP Inspector для widget rendering.

### G-19 — Apps SDK submission: privacy policy URL, screenshots, support contact — не созданы
- **Категория:** process_gap (App Store specific)
- **Severity:** BLOCKING для App Store submission
- **Свидетельство:** `docs/CHATGPT_APP_STORE.md:12, 46-49, 64-71`
- **Safe next step:** maintainer drafts + publishes.

### G-20 — Нет тестов на «fake UI controls» в widget (формальный validator)
- **Категория:** process_gap
- **Severity:** low (UI buttons manually audited)
- **Свидетельство:** `REPORT.md:212-213` (manual), `src/widget/widget.ts:170-174` (только `data-focus` buttons)
- **Safe next step:** `scripts/validate-no-fake-controls.ts` (Phase 5 expansion, не в этом прогоне)

## Unknown Unknowns (явно не заданные вопросы)

| ID | Возможный вопрос | Почему он не задан | Risk если не задан |
|---|---|---|---|
| UU-01 | Что произойдёт при одновременном MCP session 401 + bridge call? | Не тестировалось; SDK recursion bug workaround покрывает только server.close | High (race condition) |
| UU-02 | Anotator8 v25+ изменит `UDMNode` shape — adapter упадёт? | Adapter is robust через `unknownFields`, но валидация `validate_project` может выдать false negatives | Medium (post-release) |
| UU-03 | Что если ChatGPT пошлёт widget malformed JSON? | Widget использует `result.structuredContent || {}`; UI пустеет, no crash | Low |
| UU-04 | Что если 1000+ concurrent sessions? | Streamable HTTP transport per-session; no rate limit; memory bounded by `transports.size` | Medium (DoS) |
| UU-05 | Что если project JSON содержит prompt injection через label? | `suggest_labels` явно НЕ изобретает labels; но `_meta.projectData` в widget может прочитать LLM | Medium (см. G-12) |
| UU-06 | Что если Apps SDK добавит `frameDomains` requirement — придётся переcerts? | Lab НЕ ставит `frameDomains` сейчас (см. `docs/CHATGPT_APP_STORE.md:57-62`); если станет required — придётся | Low (forward) |
| UU-07 | Что если ChatGPT Apps SDK сменит postMessage origin? | Widget шлёт на `window.parent` без origin filter; если host вредоносный — token leak в `_meta.projectData` | Medium (см. G-12) |
| UU-08 | Что если MCP spec 2026-06+ сломает наш `registerAppTool` cast `as never`? | Cast задокументирован как SDK 1.29.0 quirk | Medium (upgrade time) |
| UU-09 | Что если review в App Store попросит OAuth 2.1 _до_ approval? | Документировано в `CHATGPT_APP_STORE.md:66`, maintainer должен это понимать | High (App Store) |
| UU-10 | Что если maintainer поменяет fixture но не переcертифицирует test? | `gen:fixture:check` уже в `package.json`; но reviewer всё равно должен запустить `npm test` | Low (process) |

## Сводка

- **BLOCKING gaps:** G-01, G-02, G-19 (для App Store public release)
- **HIGH-safety gaps:** G-06, G-15, G-16
- **MEDIUM gaps:** G-03, G-04, G-05, G-07, G-10, G-12, G-13, G-17
- **LOW gaps:** G-08, G-09, G-11, G-14, G-18, G-20
- **Unknown unknowns (UU-*):** 10 — все либо low либо medium; зафиксированы для re-check после каждого релиза.
