# Migration v0.4.0 → v0.5.0

> **Дата:** 2026-06-07
> **Релиз:** v0.5.0 (knowledge-base retrofit, no runtime change)
> **Верификация:** 6/6 verify PASS, 118/118 tests PASS

## Что изменилось

### Ключевые изменения
- Версия `package.json` обновлена с `0.4.0` до `0.5.0`
- Добавлен `js-yaml` как devDependency
- Добавлены 3 новых npm scripts: `validate:canonical`, `validate:truth-passport`, `validate:all`
- `scripts/verify.ts` расширен на 2 новых шага: validate:canonical + validate:truth-passport
- `npm run verify` теперь показывает 6/6 (было 4/4)

### Добавлены ( canonical knowledge base )
```
canonical/
├── active-canonical-index.yaml          (manifest v0.5.0)
├── product-dossier.yaml                 (Anotator8 v24.0.0 + lab v0.4.0 snapshot)
├── runtime-record.yaml                  (Node, deps, FS-allowlist, transports)
├── official-doc-record.yaml             (12 official docs / specs / RFCs)
├── regulatory-record.yaml               (FERPA, COPPA, GDPR, RFC 9728, RFC 6750)
├── threat-record.yaml                   (10-row threat model)
├── assurance-case-record.yaml           (top-level assurance case)
├── source-radar.yaml                    (31 sources, 4 tiers)
├── unknown-unknown.yaml                 (10 unknown unknowns)
├── tool-record/
│   ├── list-capabilities.yaml
│   ├── inspect-project.yaml
│   └── validate-project.yaml
├── decision-record/
│   ├── bridge-strategy.yaml
│   ├── auth-strategy.yaml
│   └── no-write-tool-policy.yaml
└── discovery-lead/
    └── index.yaml                       (10 discovery leads)
```

```
truth-passport/
├── lab-v0.4.0.yaml
├── tool-list-capabilities.yaml
├── tool-inspect-project.yaml
├── tool-validate-project.yaml
├── decision-bridge-strategy.yaml
├── decision-auth-strategy.yaml
└── decision-no-write-tool-policy.yaml
```

```
roles/
├── 01-product-stack-tree.md
├── 03-protocol-transport-middleware.md
├── 06-failure-casebook.md
└── 10-final-decision-matrix.md
```

```
fixtures/answer/
├── apps-sdk-bridge-vs-mcp-conformance.yaml
├── smoke-pass-vs-app-store-ready.yaml
├── allowlisted-fixture-vs-user-data.yaml
└── rfc-9728-vs-as.yaml
```

```
index/
├── ROLE_MAP.md
├── SOURCE_MAP.md
└── GAP_HARVEST.md
```

```
scripts/
├── validate-canonical.ts               (NEW, 95 lines)
└── validate-truth-passports.ts          (NEW, 102 lines)
```

### Не изменилось (explicitly preserved)
- `src/**` (0 runtime changes)
- `tests/**` (0 test changes)
- `REPORT.md` (legacy view, not overwritten)
- `docs/QA_REPORT.md` (SUPERSEDED, not overwritten)
- `docs/BUILD_REPORT.md` (SUPERSEDED, not overwritten)
- `docs/FINAL_REPORT.md` (historical, not overwritten)
- `docs/AUDIT_AGAINST_DISCOVERY_FIRST_PROMPT_v1.md` (audit v1, not overwritten)
- `fixtures/sample-project.anotator8.json` (synthetic, not overwritten)
- `fixtures/near-real-project.anotator8.json` (generated, not overwritten)
- `.github/workflows/ci.yml` (not changed)

## Директории (legacy vs canonical)

| Директория | Роль в v0.4.0 | Роль в v0.5.0 |
|---|---|---|
| `src/` | Runtime code | **Не тронуто** |
| `tests/` | Runtime tests | **Не тронуто** |
| `docs/` | Narrative docs | **Legacy views** (не перезаписаны) |
| `canonical/` | N/A | **Единый source of truth** (YAML) |
| `truth-passport/` | N/A | **Truth passports** (YAML) |
| `roles/` | NА | **Generated views** (Markdown) |
| `fixtures/answer/` | N/A | **Answer fixtures** (YAML) |
| `index/` | N/A | **Read-only справочники** (Markdown) |
| `scripts/` | Runtime scripts | **Расширено** (validators) |

## Правила (из active-canonical-index.yaml)

1. Markdown = view, не canonical truth
2. YAML beats prose
3. Truth passport резюмирует weakest-link ceiling
4. Source URL = locator only until captured + hashed
5. Platform evidence ≠ exact product evidence
6. Discovery leads ≠ claims
7. Analogies вдохновляют схемы, не доказывают факты
8. Новые роли допустимы при повторяющихся gaps
9. Нет fake hashes (CAPTURED_HASHED = реальный sha256)
10. Validators без child_process / exec / spawn
11. Legacy files не перезаписываются

## Как читать v0.5.0

### Человеку
1. Начните с `README.md` (обзор)
2. `roles/10-final-decision-matrix.md` (1-экранное состояние)
3. `index/GAP_HARVEST.md` (все gaps)
4. `canonical/active-canonical-index.yaml` (manifest)

### ИИ (LLM)
1. **Всегда** начинать ответ с truth_passport или пересказа
2. **Всегда** указывать `current_answer_ceiling`
3. **Всегда** перечислять `forbidden_shortcuts`
4. **Всегда** предлагать `safe_next_step`
5. **Никогда** не повышать статус без нового evidence
6. **Никогда** не путать LOCATOR_ONLY с CAPTURED_HASHED
7. **Никогда** не путать platform docs с exact product proof

## Контрольные точки

- [x] `npm run verify` показывает 6/6
- [x] `npm test` показывает 118/118
- [x] `npm run validate:canonical` показывает 0 errors
- [x] `npm run validate:truth-passport` показывает 0 errors (3 warnings — acceptable)
- [x] `canonical/active-canonical-index.yaml` парсится
- [x] Все 7 truth passports парсятся и проходят валидацию
- [x] Все 16 canonical YAML файлов парсятся
- [x] `src/**` не тронуто (0 изменений в runtime коде)
- [x] `tests/**` не тронуто (0 изменений в тестах)
- [x] Legacy docs не перезаписаны
