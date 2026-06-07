# Role Map — Anotator8 / MCP lab v0.5.0

> **Назначение:** спроецировать доменно-агностичные «10 role views» из системного промпта на Anotator8×ChatGPT×MCP. Этот файл — read-only справочник, не canonical source of truth.
> **Дата генерации:** 2026-06-07
> **Версия lab:** 0.4.0 → миграция на 0.5.0 (см. `MIGRATION_v0.4.0_to_v0.5.0.md`)
> **Правило:** canonical objects живут в `canonical/*.yaml`; этот файл — карта навигации для людей и LLM.

## Mapping таблица

| # | SDV role из системного промпта | Anotator8/MCP role | Canonical inputs | Generated view | Что может доказать | Чего НЕ может |
|---|---|---|---|---|---|---|
| 1 | Company / Vehicle / Platform Tree | **Product / Project / Stack Tree** | `product-dossier.yaml`, `runtime-record.yaml` | `roles/01-product-stack-tree.md` | OEM, версии продуктов, snapshot состояния | Что-то о реальной эксплуатации у пользователя |
| 2 | Hardware Layer | **Runtime & Dependency Layer** | `runtime-record.yaml`, `package.json`, FS-allowlist | `roles/02-runtime-dependency-layer.md` | Какие Node-пакеты и версии задействованы; zero shell exec; FS-allowlist | Производительность, security posture на чужой машине |
| 3 | OS / Kernel / HAL / Middleware | **Protocol / Transport / Middleware** | `official-doc-record.yaml`, MCP 2025-06-18, RFC 9728/6750 | `roles/03-protocol-transport-middleware.md` | Какой протокол/транспорт объявлен; CORS-allowlist; auth shape | Что ChatGPT на самом деле делает на своей стороне |
| 4 | Open Systems / SDK / API | **Open Specifications / SDK / API** | `official-doc-record.yaml`, Apps SDK 2026-01-26, ext-apps 1.7.4, Zod, Anotator8 schema | `roles/04-open-specs-sdk-api.md` | Какие официальные спецификации реализованы | Что Apps SDK в production ChatGPT (за пределами 2026-01-26) |
| 5 | Simulation / Testing | **Testing / Verification / Mock** | `vitest.config.ts`, `tests/`, `scripts/`, `npm run verify` | `roles/05-testing-verification-mock.md` | Сколько тестов проходит, какой smoke, какой контракт | Что тесты покрывают в production ChatGPT |
| 6 | Failure Casebook | **Failure Casebook** | `SECURITY.md`, known SDK bugs, README disclaimers | `roles/06-failure-casebook.md` | Какие режимы отказа учтены; какие короткаты запрещены | Какие новые сбои возможны в production |
| 7 | Ready / Semi-ready Solutions | **Ready / Semi-ready Solutions** | MCP Inspector, Cloudflare Tunnel, ngrok, OAuth 2.1 AS ref, App Store runbook | `roles/07-ready-semi-ready-solutions.md` | Какие готовые решения можно переиспользовать как идею | Что они будут работать в production без адаптации |
| 8 | External Connectivity | **External Connectivity** | `MCP_COMPATIBILITY.md`, OAuth PRM, transport matrix | `roles/08-external-connectivity.md` | Какие клиенты подтверждены (smoke, demo, contract) | Что все клиенты реально работают (большинство ⏳) |
| 9 | Implementation Blueprints | **Implementation Blueprints** | `src/`, `src/widget/`, 8 tool implementations | `roles/09-implementation-blueprints.md` | Как устроен каждый tool / widget | Что blueprints безопасны для production |
| 10 | Final Decision Matrix | **Final Decision Matrix** | все truth passports, source-radar, gap-harvest | `roles/10-final-decision-matrix.md` | Текущее состояние за 1 экран | Что состояние не ухудшится |

## Базовые роли (10 стартовых) vs Расширенные роли (новые кандидаты)

В системном промпте перечислены 10 базовых ролей + предложено расширение. Для Anotator8/MCP применимы:

### Применяются напрямую (10/10)

1. ✅ Product / Project / Stack Tree
2. ✅ Runtime & Dependency Layer
3. ✅ Protocol / Transport / Middleware
4. ✅ Open Specifications / SDK / API
5. ✅ Testing / Verification / Mock
6. ✅ Failure Casebook
7. ✅ Ready / Semi-ready Solutions
8. ✅ External Connectivity
9. ✅ Implementation Blueprints
10. ✅ Final Decision Matrix

### Дополнительные роли (предложены системным промптом, проверены на релевантность)

| Кандидат | Применимо? | Где хранится |
|---|---|---|
| Source Radar / Evidence Registry | ✅ применимо | `canonical/source-radar.yaml` |
| Exact Vehicle Intake Queue | 🔁 переименовано в Exact Product Intake | `canonical/product-dossier.yaml` (поля `intake.queue`) |
| Privacy & Data Governance | ✅ применимо | `canonical/regulatory-record.yaml` (FERPA/COPPA/GDPR), `docs/SECURITY.md` |
| Safety Case / Assurance Case | ✅ применимо (как security assurance) | `canonical/assurance-case-record.yaml`, `docs/SECURITY.md` |
| Cybersecurity Threat Model | ✅ применимо | `canonical/threat-record.yaml` |
| Regulatory / Compliance Map | ✅ применимо | `canonical/regulatory-record.yaml` |
| UX & Driver Distraction Matrix | ❌ N/A — не infotainment for vehicle; заменено на **Widget Scope & Bridge** | `roles/06-failure-casebook.md` § widget, `docs/MCP_COMPATIBILITY.md` |
| Release Evidence Bundle | ✅ применимо | `release-report-v0.5.0.md` (для этой версии); REPO_EVIDENCE-таблицы в `REPORT.md` |
| OEM Authorization / Lab Boundary | ✅ применимо как «Anotator8 untouched» | `docs/AUDIT_AGAINST_DISCOVERY_FIRST_PROMPT_v1.md` § Verification, `canonical/assurance-case-record.yaml` |
| Toolchain & Reproducibility | ✅ применимо | `runtime-record.yaml`, `package.json` |
| Benchmark of Analog Libraries | ✅ применимо | `roles/07-ready-semi-ready-solutions.md` (Cloudflare Tunnel, ngrok, MCP Inspector, OAuth 2.1 AS) |
| Unknown Unknowns Backlog | ✅ применимо | `index/GAP_HARVEST.md`, `canonical/unknown-unknown.yaml` |

### Не применимо к Anotator8/MCP

- ❌ Cockpit / Head Unit / Instrument Cluster (нет hardware ECU)
- ❌ Powertrain / BMS / ADAS (нет safety-critical ECUs)
- ❌ AUTOSAR Classic / Adaptive (лаб на TS + Node, не на AUTOSAR)
- ❌ VSS/VISS (нет облака телеметрии)
- ❌ CARLA / Autoware / SOAFEE (не ROS / не cloud-native SDV)
- ❌ Motion Lock / Driver Distraction (только виджет в ChatGPT iframe; не automotive HMI)

## Role precedence rule

> Если два role views дают разные ответы — **Trust = min(answer_ceiling)**.
> Markdown view никогда не сильнее canonical YAML.

## Что эта карта НЕ покрывает

- Не отвечает на «что _точно_ работает у пользователя X» — это домен `Exact Product Intake` (см. `canonical/product-dossier.yaml` § intake).
- Не заменяет RELEASE_EVIDENCE_BUNDLE (см. `release-report-v0.5.0.md`).
- Не генерируется автоматически. Это hand-curated navigation aid. `roles/*.md` — generated views; `index/ROLE_MAP.md` — статический справочник.
