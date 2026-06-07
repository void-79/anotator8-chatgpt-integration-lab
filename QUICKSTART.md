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

Эта команда делает четыре вещи подряд:
- `npm run build` — пересборка
- `npm test` — 118/118 тестов
- `npm run smoke` — реальный HTTP roundtrip против `/mcp`
- `npm run demo:stdio` — реальный stdio roundtrip через SDK
  client (как в Claude Desktop, Cursor, Windsurf и т.д.)

Если в конце видишь `OK: 4/4 checks passed` — всё работает.

## 3. Подключить MCP-клиент

### Вариант A — локальный stdio клиент (Claude Desktop, Cursor, Cline, и т.д.)

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

### Вариант B — HTTP клиент (ChatGPT, OpenAI Platform, MCP Inspector)

Запусти сервер:

```bash
npm run dev
```

Он слушает на `http://127.0.0.1:8787/mcp`. Дальше:

- **MCP Inspector** (дебаг): `npm run inspect` в другом
  терминале — откроется UI в браузере.
- **ChatGPT Developer Mode** (удалённо): нужен HTTPS-туннель
  (`cloudflared` / `ngrok`) и платный ChatGPT-аккаунт. См.
  `docs/CHATGPT_APP_SETUP.md` § ChatGPT Developer Mode.

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
```

Если что-то из этого падает — это регрессия. Скопируй вывод и
проверь, какая команда упала.

Больше деталей — в `README.md` (полный обзор), `docs/ARCHITECTURE.md`
(слои сервера), `docs/CHATGPT_APP_SETUP.md` (если хочется
ChatGPT), `docs/MCP_COMPATIBILITY.md` (какие клиенты поддерживаются).
