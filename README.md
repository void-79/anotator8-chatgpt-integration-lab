# Anotator8 x ChatGPT Integration Lab

> **Хочешь просто запустить? → [QUICKSTART.md](QUICKSTART.md)** (3 шага + проверка)
>
> * `npm install && npm run build`
> * `npm run verify` — 6/6 проверок: build, 118 тестов, HTTP smoke, stdio roundtrip, 2 валидатора
> * Вставь config snippet из QUICKSTART в Claude Desktop / Cursor / любой MCP-клиент

---

## Что это

**Локальный MCP-сервер**, который позволяет ChatGPT (и другим AI-ассистентам) читать и анализировать проекты Anotator8 — инструмента видеомаркировки.

Lab запускается **на вашем компьютере**. Для ChatGPT нужен **tunnel** (ngrok / Cloudflare Tunnel) — это **поддерживаемый workflow от OpenAI**, не костыль.

**Источник:** OpenAI Apps SDK quickstart (2026-06-07):
> "Ensure your MCP server is reachable over HTTPS (for local development, use **Secure MCP Tunnel** or **ngrok** / **Cloudflare Tunnel**)."

> "As of November 13th, 2025, ChatGPT Apps are supported on **all plans**, including Business, Enterprise, and Education plans."

**Version:** 0.5.0 — **118/118** tests, **6/6** verify (build + test + smoke + stdio + 2 validators). See [REPORT.md](REPORT.md) for the authoritative current report.

---

## Как это работает

```
ChatGPT (облако OpenAI)
  ↓ HTTPS запрос
Tunnel (ngrok / Cloudflare Tunnel)
  ↓ проброс на localhost
Ваш компьютер (127.0.0.1:8787)
  ↓
Lab MCP сервер (Node.js)
```

**Для Claude Desktop / Cursor / Windsurf / Cline** — tunnel НЕ нужен. Lab работает через stdio напрямую.

**Для ChatGPT** — tunnel обязателен. ChatGPT не может подключиться к localhost напрямую.

---

## Два слоя, один сервер

| Layer | Что | Кто использует |
| --- | --- | --- |
| **Universal MCP** (всегда включён) | 8 read-only tools, 1 prompt, 1 HTML resource, Streamable HTTP, stdio, OAuth 2.0 PRM (RFC 9728), Bearer (RFC 6750) | Claude Desktop, Cursor, Windsurf, Cline, OpenCode, Aider, Continue, MCP Inspector, ChatGPT, любое MCP 2025-06-18 устройство |
| **ChatGPT Apps SDK** (верхний, опциональный) | Apps host bridge (`ui/initialize` / `tools/call`, `protocolVersion: 2026-01-26`), widget HTML, `_meta.ui.resourceUri` на каждом tool | ChatGPT Developer Mode, ChatGPT App Store |

Layers are independent. Non-ChatGPT clients ignore the Apps SDK `_meta` keys harmlessly.

**Источник:** OpenAI Reference (2026-06-07):
> "Apps SDK support is here to stay—we have no plans to deprecate it."

---

## Запуск

### Локально (без ChatGPT)

```powershell
npm install
npm run build
npm test            # 118/118
npm run verify      # 6/6
npm run dev         # HTTP сервер на 127.0.0.1:8787
npm run inspect     # MCP Inspector
```

Для Claude Desktop / Cursor / Windsurf / Cline:

```text
node dist/server/index.js   # requires MCP_TRANSPORT=stdio
```

### С ChatGPT (через tunnel)

```powershell
# 1. Запускаете lab
npm run dev

# 2. Запускаете tunnel (бесплатно)
ngrok http 8787
# → https://abc123.ngrok.app

# 3. В ChatGPT: Settings → Connectors → Create
#    URL: https://abc123.ngrok.app/mcp
#    Name: Anotator8

# 4. В чате: "Inspect fixture sample-project"
```

**Ограничения tunnel:**
- URL меняется при перезапуске ngrok (бесплатный тариф)
- Lab работает только пока компьютер включён
- Нужно обновлять connector URL при перезапуске

**Решения:**
- Cloudflare Tunnel с токеном (стабильный URL, бесплатно)
- VPS + nginx (постоянный URL, $5-10/мес)
- OpenAI: "Refresh" button в Settings → Connectors

Подробнее: [docs/CHATGPT_APP_SETUP.md](docs/CHATGPT_APP_SETUP.md)

---

## Tools

| Tool | Purpose | Read/write |
| --- | --- | --- |
| `list_capabilities` | Show features, limitations, supported fixtures | read |
| `inspect_project` | Normalize source, annotation, subtitle, timeline, warning summary | read |
| `validate_project` | Validate ids, time ranges, subtitle references, source metadata | read |
| `summarize_annotations` | Count actual annotations by type/shape/label/timing | read |
| `find_annotations` | Filter actual annotations by type, label/text, confidence, time | read |
| `suggest_labels` | Identify label review tasks without inventing labels | read |
| `create_review_plan` | Produce manual review checklist | read |
| `export_chatgpt_report` | Return Markdown/JSON report; does not write files | read |

Все tools: `readOnlyHint: true, destructiveHint: false, openWorldHint: false`. Никаких изменений данных.

---

## Что работает и что нет

| Возможность | Статус | Доказательство |
|---|---|---|
| 8 read-only tools | ✅ Работает | 118/118 tests, MCP Inspector |
| ChatGPT видит tools | ✅ Работает | Connector wizard + tunnel |
| ChatGPT вызывает tools | ✅ Работает | tools/call через tunnel |
| Виджет в iframe | ✅ Работает | MCP Apps bridge + contract tests |
| Мобильный ChatGPT | ✅ Работает | "available on ChatGPT mobile apps as well" |
| Claude Desktop / Cursor | ✅ Работает | stdio, без tunnel |
| OAuth 2.1 | ❌ Не реализован | Только Bearer token (demo) |
| App Store | ❌ Не готов | Нужен OAuth + privacy policy + screenshots |
| Постоянный сервер | ❌ Не развёрнут | Нужен VPS или Cloudflare Tunnel |
| Автозапуск | ❌ Нет | Нужно запускать lab + tunnel вручную |

---

## Fixture

`fixtures/sample-project.anotator8.json` is synthetic but based on Anotator8 24.0.0 project file evidence. See [docs/PRODUCT_SURFACE.md](docs/PRODUCT_SURFACE.md) for the full REPO_EVIDENCE-backed surface map.

---

## Docs

- [Final Report](REPORT.md) — current authoritative status
- [Architecture](docs/ARCHITECTURE.md) — layer split (universal MCP + Apps SDK)
- [MCP Compatibility](docs/MCP_COMPATIBILITY.md) — client × feature matrix
- [Product Surface](docs/PRODUCT_SURFACE.md) — verified Anotator8 data model
- [Prototype Audit](docs/PROTOTYPE_AUDIT.md) — old connector audit
- [Security](docs/SECURITY.md)
- [ChatGPT App Setup](docs/CHATGPT_APP_SETUP.md) — ChatGPT-specific + tunnel + local clients
- [Tool Contracts](docs/TOOL_CONTRACTS.md)
- [Porting to Anotator8](docs/PORTING_TO_ANOTATOR8.md)
- [Official Docs Research](docs/research/OFFICIAL_DOCS_RESEARCH.md) — Apps SDK + MCP research table
- [Dependency Audit](docs/DEPENDENCY_AUDIT.md) — vitest 2 → 3, blocked on 4
- [ChatGPT App Store](docs/CHATGPT_APP_STORE.md) — submission runbook
- [Knowledge Base](canonical/active-canonical-index.yaml) — truth passports, evidence ceiling, gap tracking
