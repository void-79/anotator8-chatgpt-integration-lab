# Quickstart

Три шага, чтобы запустить MCP-сервер для Anotator8.

## 1. Установить и собрать

```bash
cd C:\anotator8-chatgpt-integration-lab
npm install
npm run build
```

`npm run build` очищает `dist/` и компилирует `src/server/*` в
`dist/server/index.js` (это бинарь, который будут запускать
MCP-клиенты).

## 2. Проверить, что работает

```bash
npm run verify
```

Эта команда делает шесть вещей подряд:
- `npm run build` — пересборка
- `npm test` — 118/118 тестов
- `npm run smoke` — реальный HTTP roundtrip против `/mcp`
- `npm run demo:stdio` — реальный stdio roundtrip через SDK
  client (как в Claude Desktop, Cursor, Windsurf и т.д.)
- `npm run validate:canonical` — валидация canonical YAML объектов
- `npm run validate:truth-passport` — валидация truth passports

Если в конце видишь `passed: 6/6` — всё работает.

## 3. Подключить MCP-клиент

### Вариант A — локальный stdio клиент (Claude Desktop, Cursor, Cline, Windsurf, и т.д.)

Эти клиенты запускают сервер как подпроцесс и общаются через
stdin/stdout. Никакой туннель, никакой токен, всё локально.

**Claude Desktop** — отредактируй
`%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "anotator8": {
      "command": "node",
      "args": [
        "C:\\anotator8-chatgpt-integration-lab\\dist\\server\\index.js"
      ],
      "env": { "MCP_TRANSPORT": "stdio" }
    }
  }
}
```

**Cursor** — отредактируй `.cursor/mcp.json` в корне проекта
(или глобально в `~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "anotator8": {
      "command": "node",
      "args": [
        "C:\\anotator8-chatgpt-integration-lab\\dist\\server\\index.js"
      ],
      "env": { "MCP_TRANSPORT": "stdio" }
    }
  }
}
```

**Cline (VS Code)**, **Windsurf**, **Continue**, **OpenCode** —
формат такой же: `command` + `args` + `env`, файл `mcp.json` в
соответствующей директории.

На macOS / Linux путь в `args` будет
`/Users/you/anotator8-chatgpt-integration-lab/dist/server/index.js`
(без `C:\\` и escape).

После сохранения конфига — перезапусти клиент. Должен появиться
сервер `anotator8` с 8 tools (`inspect_project`,
`validate_project`, `summarize_annotations`, и т.д.).

### Вариант B — ChatGPT (через tunnel)

ChatGPT — облачный сервис. Он НЕ может подключиться к `127.0.0.1`
на вашем компьютере напрямую. Нужен **tunnel**.

**Поддерживаемый workflow от OpenAI:**

> "Ensure your MCP server is reachable over HTTPS (for local
> development, use **Secure MCP Tunnel** or **ngrok** /
> **Cloudflare Tunnel**)."
> — OpenAI Apps SDK quickstart (2026-06-07)

**Шаг 1:** Запусти lab:
```bash
npm run dev
```

**Шаг 2:** Запусти tunnel (бесплатно):
```bash
ngrok http 8787
# → https://abc123.ngrok.app
```

**Шаг 3:** В ChatGPT:
1. Settings → Apps & Connectors → Advanced settings → Developer mode → ON
2. Settings → Connectors → Create
3. URL: `https://abc123.ngrok.app/mcp`
4. Name: Anotator8
5. В чате: "Inspect fixture sample-project"

**Ограничения tunnel:**
- URL меняется при перезапуске ngrok (бесплатный тариф)
- Lab работает только пока компьютер включён
- Нужно обновлять connector URL при перезапуске

**Решения:**
- Cloudflare Tunnel с токеном (стабильный URL, бесплатно)
- VPS + nginx (постоянный URL, $5-10/мес)
- OpenAI: "Refresh" button в Settings → Connectors

**Важно:** ChatGPT поддерживает connectors на **всех тарифах**,
включая бесплатный. Платный аккаунт не требуется.

> "As of November 13th, 2025, ChatGPT Apps are supported on
> **all plans**, including Business, Enterprise, and Education
> plans."
> — OpenAI Apps SDK (2026-06-07)

Подробнее: `docs/CHATGPT_APP_SETUP.md`

### Вариант C — MCP Inspector (дебаг)

```bash
npm run dev        # в одном терминале
npm run inspect    # в другом — откроется UI в браузере
```

## Что внутри

8 read-only tools — все только читают проект, ничего не пишут:

| Tool | Что делает |
| --- | --- |
| `list_capabilities` | Какие фичи поддерживаются + ограничения |
| `inspect_project` | Сводка по проекту: аннотации, субтитры, таймлайн, варнинги |
| `validate_project` | Проверка целостности (id, time ranges, cue references) |
| `summarize_annotations` | Распределение аннотаций по типу/форме/label |
| `find_annotations` | Фильтр аннотаций (тип, label, time range, confidence) |
| `suggest_labels` | Где нужен человеческий выбор label (без выдумывания) |
| `create_review_plan` | Чеклист для ручного ревью |
| `export_chatgpt_report` | Markdown/JSON отчёт (возвращается, не пишется) |

Сервер никогда не читает видео-файлы, никогда не пишет в
файловую систему, не выполняет shell-команд. Единственное, что
он принимает от клиента — JSON с проектом (или
`fixtureId: "sample-project"` для встроенной демо-фикстуры) и
возвращает структурированный ответ.

## Если что-то сломалось

```bash
npm run build     # 0 errors ожидается
npm test          # 118/118 expected
npm run smoke     # "SMOKE PASS" в конце
npm run demo:stdio # "STDIO SMOKE PASS" в конце
npm run verify    # 6/6 expected
```

Если что-то из этого падает — это регрессия. Скопируй вывод и
проверь, какая команда упала.

Больше деталей — в `README.md` (полный обзор), `docs/ARCHITECTURE.md`
(слои сервера), `docs/CHATGPT_APP_SETUP.md` (если хочется
ChatGPT), `docs/MCP_COMPATIBILITY.md` (какие клиенты поддерживаются).
