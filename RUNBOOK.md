# RUNBOOK — запуск Anotator8 × ChatGPT коннектора на чистой Windows-машине

> **Для кого:** человек, который умеет открыть PowerShell и вставлять команды, но не хочет разбираться в коде.
> **Цель:** за 15–30 минут получить работающий ChatGPT, который может читать и анализировать проекты Anotator8 (но **ничего в них не править**).
> **Версия лаба:** 0.9.0 (проверено 2026-06-08: 224/224 теста, 8/8 verify).

---

## Что вы получите в итоге

- Локальный MCP-сервер на вашем компьютере (`127.0.0.1:8787`).
- Публичный HTTPS-адрес через Cloudflare Tunnel (стабильный, бесплатный).
- Коннектор в ChatGPT, который появляется в любом новом чате.
- 8 read-only инструментов: `inspect_project`, `validate_project`, `summarize_annotations`, `find_annotations`, `suggest_labels`, `create_review_plan`, `export_chatgpt_report`, `list_capabilities`.
- Веб-виджет внутри ChatGPT, который показывает сводку по проекту.
- **Никаких** изменений в вашем Anotator8. **Никаких** записей в файловую систему с вашего компа. **Никакого** shell-доступа.

---

## Connect Helper — всплывающее окно с готовыми значениями

После запуска `setup.ps1` автоматически открывает файл [`connect-helper.html`](connect-helper.html) в вашем браузере. Это **портативный HTML-файл без зависимостей** — он работает на Windows, macOS и Linux, не требует интернета после открытия, не отправляет данные никуда.

Что в нём есть:

- **3 вкладки**: Cloudflare Tunnel, ngrok, Local (stdio для Claude Desktop / Cursor / Cline / Windsurf).
- **Status-бар** наверху: видно в реальном времени — запущен ли лаб, найден ли тунель, валиден ли токен из `.env`.
- **Готовые значения** для каждого поля формы ChatGPT (Name, URL, Auth, MCP_AUTH_TOKEN).
- **Кнопка Copy** рядом с каждым полем + кнопка **Copy all** (одним кликом копирует все значения сразу).
- **Автоопределение** URL тунеля — окно само пробует прочитать ngrok API (`:4040`) или попросит ввести вручную.
- **Быстрые ссылки** на все нужные страницы ChatGPT и Cloudflare (открываются в новой вкладке).
- **Красивый вывод ошибок**: если вдруг copy не сработает, поле подсветится и подсказка "Press Ctrl+C".

Если `setup.ps1` не открыл helper автоматически — просто откройте `connect-helper.html` двойным кликом в проводнике.

---

## Что нужно из установленного (проверьте заранее)

| Требование | Минимальная версия | Как проверить |
|---|---|---|
| Windows | 10 / 11 | Win+R → `winver` |
| PowerShell | 5.1 (встроен) | `powershell $PSVersionTable.PSVersion` |
| Node.js | 20+ | `node --version` |
| Git | любой | `git --version` |
| Браузер | любой | — |
| ChatGPT аккаунт | Plus/Pro/Team/Enterprise/Edu/Free (Developer Mode на всех платных) | — |
| Cloudflare аккаунт | бесплатный | https://dash.cloudflare.com/sign-up |
| Домен (опционально) | свой, добавленный в Cloudflare | — |

Если чего-то нет — `setup.ps1` (см. ниже) сам скачает и установит.

---

## Путь A — автоматический (PowerShell-скрипт)

Самый простой путь. Скрипт сам: проверит, что стоит, установит недостающее, склонирует лаб, соберёт, запустит тунель, выдаст вам готовый URL и инструкцию для ChatGPT.

```powershell
# 1. Откройте PowerShell от администратора (Win+X → "Windows PowerShell (Admin)" или "Terminal (Admin)")
# 2. Разрешите запускать локальные скрипты в этой сессии
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# 3. Скачайте и запустите setup-скрипт прямо из репозитория
#    (замените <REPO_URL> на реальный URL, если лаб переедет)
irm https://raw.githubusercontent.com/void-79/anotator8-chatgpt-integration-lab/main/scripts/setup.ps1 -OutFile setup.ps1
.\setup.ps1
```

`setup.ps1` задаст 4 вопроса:
1. Куда положить лаб (по умолчанию `C:\anotator8-chatgpt-integration-lab`).
2. Какой тунель использовать: **Cloudflare** (рекомендую) или **ngrok** (на скорую руку).
3. Сгенерировать ли новый `MCP_AUTH_TOKEN` или использовать ваш.
4. Имя коннектора в ChatGPT (по умолчанию `Anotator8 Lab`).

В конце скрипт напечатает **готовый URL вида `https://anotator8-lab.<ваш-домен>/mcp`** и кнопку "Скопировать инструкцию для ChatGPT".

---

## Путь B — ручной (пошагово)

### Шаг 1. Установите Node.js (если нет)

Скачайте LTS-версию с https://nodejs.org/, запустите установщик, **обязательно** поставьте галочку "Add to PATH".

Проверьте:
```powershell
node --version    # должно быть v20.x или выше
npm --version     # должно быть 10.x или выше
```

### Шаг 2. Скачайте лаб

```powershell
cd C:\
git clone https://github.com/void-79/anotator8-chatgpt-integration-lab.git
cd anotator8-chatgpt-integration-lab
```

> **Не** клонируйте в папку, путь которой содержит пробелы или кириллицу. `C:\anotator8-chatgpt-integration-lab` — идеально.

### Шаг 3. Сконфигурируйте `.env`

```powershell
copy .env.example .env
notepad .env
```

Впишите (или оставьте значения по умолчанию):

```env
# Хост и порт лаб-сервера
MCP_HOST=127.0.0.1
MCP_PORT=8787

# Секрет, по которому ChatGPT будет авторизоваться.
# ОБЯЗАТЕЛЬНО смените. Минимум 32 символа.
# Сгенерировать: [guid]::NewGuid().Guid + [guid]::NewGuid().Guid
MCP_AUTH_TOKEN=change-me-long-random-string-please-paste-from-generator

# Разрешённый origin (CORS) — пока оставьте *
CORS_ORIGIN=*

# OAuth PRM (RFC 9728) — публичное имя коннектора
MCP_OAUTH_RESOURCE_NAME=Anotator8 Lab
MCP_OAUTH_RESOURCE_DOCUMENTATION=https://github.com/void-79/anotator8-chatgpt-integration-lab
```

Сохраните и закройте блокнот.

### Шаг 4. Соберите и проверьте

```powershell
npm install                # ~2 минуты
npm run build              # 0 ошибок
npm test                   # 224/224 должно пройти
npm run smoke              # в конце "SMOKE PASS"
```

Если что-то падает — не идите дальше, почините сначала. 90% проблем = старая версия Node или сломанный npm cache. Чинится так:

```powershell
node --version             # должно быть 20+
Remove-Item -Recurse -Force node_modules
npm cache clean --force
npm install
```

### Шаг 5. Запустите тунель

#### Вариант 1: Cloudflare Tunnel (рекомендую, стабильный URL)

1. Зарегистрируйтесь на https://dash.cloudflare.com/ (бесплатно).
2. Добавьте свой домен (например `mydomain.com`) — Cloudflare даст инструкции по смене NS-серверов у регистратора.
3. Создайте тунель:
   - https://one.dash.cloudflare.com/ → **Networks** → **Tunnels** → **Create a tunnel** → **Cloudflared** → дайте имя `anotator8-lab`.
   - Скопируйте **токен тунеля** (длинная строка).
4. Установите `cloudflared`:
   ```powershell
   winget install --id Cloudflare.cloudflared
   ```
5. Запустите тунель:
   ```powershell
   $env:TUNNEL_TOKEN = "eyJhIjoixxxxxxxxxxxxxxxx"   # ваш токен
   cloudflared tunnel run anotator8-lab
   ```
   В логах появится строка вида:
   ```
   https://anotator8-lab.mydomain.com
   ```
   **Это и есть ваш публичный URL.** Запомните его.

#### Вариант 2: ngrok (на скорую руку, URL меняется при перезапуске)

1. Скачайте ngrok: https://ngrok.com/download (бесплатный аккаунт).
2. Распакуйте, добавьте в PATH.
3. Авторизуйтесь:
   ```powershell
   ngrok config add-authtoken <ваш_токен_из_личного_кабинета_ngrok>
   ```
4. Запустите:
   ```powershell
   ngrok http 8787
   ```
   В логах будет строка `https://abc123.ngrok-free.app` — это ваш URL. **При перезапуске ngrok URL изменится** — придётся пересоздавать коннектор в ChatGPT.

### Шаг 6. Запустите лаб-сервер

В **другом** окне PowerShell (тунель должен уже работать):

```powershell
cd C:\anotator8-chatgpt-integration-lab
npm run dev
```

В логах должно появиться:
```
MCP HTTP server listening on 127.0.0.1:8787
[audit] oauth-factory ok mode=local
```

**Не закрывайте это окно.** Лаб работает, пока работает это окно.

### Шаг 7. Проверьте, что всё видно снаружи

В **третьем** окне PowerShell:

```powershell
# Замените URL на свой из шага 5
$url = "https://anotator8-lab.mydomain.com"

# 1. PRM endpoint должен отвечать
curl "$url/.well-known/oauth-protected-resource/mcp"
# Ожидаем JSON с полем "resource" и "authorization_servers"

# 2. Инициализация MCP должна вернуть serverInfo
curl -X POST "$url/mcp" `
     -H "Content-Type: application/json" `
     -H "Accept: application/json, text/event-stream" `
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"manual-curl","version":"0"}}}'
# Ожидаем JSON-RPC ответ с serverInfo.name = "anotator8-chatgpt-integration-lab"
```

Если оба ответа пришли — можно идти в ChatGPT.

### Шаг 8. Добавьте коннектор в ChatGPT

1. Откройте https://chatgpt.com/.
2. **Settings → Apps & Connectors → Advanced settings → Developer mode → ON**.
3. Вернитесь назад → **Settings → Connectors → Create** (или **Apps → Create app** в зависимости от версии).
4. Заполните форму:

   | Поле | Значение |
   |---|---|
   | **Значок** (опционально) | пропустите, для App Store потом |
   | **Название** | `Anotator8 Lab` |
   | **Описание** | `Read-only ChatGPT integration for Anotator8 projects` |
   | **Подключение** → `URL-адрес сервера` | **оставьте эту вкладку** |
   | **URL** | `https://anotator8-lab.mydomain.com/mcp` (ваш URL из шага 5) |
   | **Аутентификация** | оставьте `OAuth` |
   | **Чекбокс согласия** | **поставьте галочку** |
   | **Создать** | нажмите |

5. ChatGPT откроет OAuth-окно — разрешите доступ.

### Шаг 9. Проверьте в чате

В новом чате ChatGPT:

```
+ → включите коннектор "Anotator8 Lab"

Используй только Anotator8 Lab. Сделай inspect_project на fixtureId: sample-project.
```

Если ChatGPT вызвал `inspect_project` и вернул сводку — **готово, всё работает**.

---

## Что делать, когда захочется остановить

1. Закройте окно PowerShell с `npm run dev` (или Ctrl+C в нём).
2. Закройте окно PowerShell с тунелем.

Чтобы запустить заново — повторите шаги 5–9.

---

## Безопасность — что вы соглашаетесь, поднимая это

- **Что ChatGPT увидит:** вы **сами** отправляете ему project JSON (или используете встроенную фикстуру `sample-project`). ChatGPT прочитает аннотации, субтитры, таймлайн, метаданные проекта. **Никогда** не отправляйте проект с настоящими персональными данными учеников без юридического основания.
- **Что НЕ произойдёт:** ChatGPT **не сможет** запускать shell, читать ваши файлы (кроме того JSON, который вы ему передали), или изменять Anotator8. Это enforced кодом лаба.
- **Тунель:** это публичный HTTPS-адрес, ведущий к вашему localhost. Любой, кто узнает URL и `MCP_AUTH_TOKEN`, сможет пользоваться коннектором от вашего имени. **Никому** не давайте URL и токен.
- **OAuth:** лаб использует OAuth 2.1 с PKCE. Чат-сессии ChatGPT получают **короткоживущие токены** (15 минут по умолчанию) с авто-обновлением; revoke возможен в любой момент из ChatGPT.
- **Demo-mode:** если вы **не** установили `MCP_AUTH_TOKEN`, сервер при старте печатает баннер "DEMO-ONLY — не выставляйте наружу". **Не игнорируйте это предупреждение.**

---

## Troubleshooting (типовые проблемы)

См. отдельный файл [TROUBLESHOOTING.md](TROUBLESHOOTING.md). Краткий список самых частых:

| Симптом | Скорее всего | Решение |
|---|---|---|
| `node is not recognized` | Node не в PATH | Переустановите Node с галочкой "Add to PATH", откройте новый PowerShell |
| `EACCES` на `npm install` | Антивирус блокирует symlinks | Добавьте папку лаба в исключения антивируса |
| `npm run smoke` пишет "port already in use" | Порт 8787 занят | `netstat -ano \| findstr :8787`, убейте процесс по PID, или смените `MCP_PORT` в `.env` |
| ChatGPT пишет "Can't reach server" | Тунель не запущен или URL неправильный | Проверьте, что окно тунеля открыто, и что URL заканчивается на `/mcp` |
| ChatGPT OAuth-окно не открывается | Cloudflare блокирует запросы из РФ/КЗ | Используйте ngrok или включите Cloudflare WARP |
| Тесты `npm test` падают с "Maximum call stack size exceeded" | Это НЕ тест, это известный баг MCP SDK 1.29.0 | `tests/unit/rejection-capture.test.ts` доказывает, что handler ловит его; обновите SDK, когда починят upstream |
| `npm run typecheck` падает с 4 ошибками | Известный pre-existing drift | Не блокирует работу; будет исправлено в следующей версии лаба |

---

## Что дальше

После того как всё заработало, вы можете:

1. **Поделиться лабом** с коллегами — дайте им ссылку на этот RUNBOOK и публичный URL вашего тунеля (если доверяете).
2. **Залить в App Store ChatGPT** — см. [docs/CHATGPT_APP_STORE.md](docs/CHATGPT_APP_STORE.md) (требует OAuth-приложения, privacy policy, скриншоты, ревью).
3. **Перенести логику в Anotator8** — см. [docs/PORTING_TO_ANOTATOR8.md](docs/PORTING_TO_ANOTATOR8.md) (план поэтапного переноса).
4. **Добавить новые tools** — см. [docs/TOOL_CONTRACTS.md](docs/TOOL_CONTRACTS.md) (как устроен контракт tool-а).

---

## Доказательства, что это работает (для скептиков)

Последняя верификация (2026-06-08): 224/224 unit + integration + contract тестов прошли, `npm run verify` = 8/8, OAuth 2.1 PRM + AS + refresh tokens + family revocation работают, headless MCP Inspector roundtrip = PASS, 0 production-dependency vulnerabilities, Anotator8 не тронут (0 вхождений `chatgpt|openai|mcp` в `C:\Anotator8\src`). Полный отчёт: [REPORT.md](REPORT.md).
