# Troubleshooting — Anotator8 × ChatGPT Integration Lab

> Эта страница — для случая, когда что-то пошло не так. Каждый раздел: **симптом → диагноз → фикс**.
> Если не нашли свой случай — откройте issue в репозитории лаба с приложенным `lab.out.log` и `lab.err.log`.

---

## 1. Установка и prerequisites

### 1.1 `node is not recognized as the name of a cmdlet`

**Причина:** Node.js не установлен или не в PATH.

**Фикс:**
1. Скачайте LTS с https://nodejs.org/
2. При установке **обязательно** отметьте "Add to PATH"
3. Закройте PowerShell и откройте **новое** окно
4. `node --version` → должно быть `v20.x.x` или выше

### 1.2 `npm install` падает с `EACCES` или `EPERM`

**Причина 1:** Антивирус блокирует symlinks (часто Касперский, Avast, Defender с усиленными правилами).
**Фикс:** Добавьте папку `C:\anotator8-chatgpt-integration-lab` в исключения антивируса.

**Причина 2:** PowerShell был открыт от обычного пользователя, а `node_modules` создавался от админа (или наоборот).
**Фикс:**
```powershell
Remove-Item -Recurse -Force node_modules, package-lock.json -ErrorAction SilentlyContinue
npm cache clean --force
npm install
```

**Причина 3:** Путь содержит кириллицу или пробелы (например `C:\Мои документы\Anotator8 Lab`).
**Фикс:** Перенесите в `C:\anotator8-chatgpt-integration-lab`.

### 1.3 `git is not recognized`

**Фикс:** https://git-scm.com/download/win → установите с дефолтами → новый PowerShell.

### 1.4 `npm run build` падает с TypeScript-ошибками

**Если ошибки в `src/`:** баг в лабе. Откройте issue.

**Если ошибки в `scripts/` или `tests/` (4 известных pre-existing ошибки):** это `npm run typecheck` (а не build). Build использует более узкий `tsconfig.build.json` и не видит эти файлы. **Игнорируйте** — на работу не влияет. Полный список в [REPORT.md](REPORT.md) Phase 7.

---

## 2. Запуск лаб-сервера

### 2.1 `Port 8787 is already in use`

**Диагноз:**
```powershell
netstat -ano | findstr :8787
# увидите:  TCP    0.0.0.0:8787    ...    LISTENING    <PID>
```

**Фикс 1 (быстрый):** убейте процесс
```powershell
taskkill /F /PID <PID>
```

**Фикс 2 (правильный):** смените порт
```powershell
# в .env
MCP_PORT=8788
```
И смените URL в форме ChatGPT на `https://<тунель>:8788/mcp`.

### 2.2 В `lab.err.log` — `Cannot find module '@modelcontextprotocol/sdk'`

**Причина:** `npm install` не докачал зависимости или был прерван.
**Фикс:**
```powershell
Remove-Item -Recurse -Force node_modules
npm install
npm run build
```

### 2.3 В `lab.out.log` — `MCP HTTP server listening on 127.0.0.1:8787` НЕ появилось, а появилось `[auth] DEMO-ONLY`

Это **нормально**, не ошибка. Означает, что `MCP_AUTH_TOKEN` пуст в `.env`, и сервер работает в demo-режиме. **Не выставляйте demo-режим в интернет** — сгенерируйте токен:
```powershell
# Сгенерировать и вписать в .env
$token = [guid]::NewGuid().Guid + [guid]::NewGuid().Guid
(Get-Content .env) -replace '^MCP_AUTH_TOKEN=.*$', "MCP_AUTH_TOKEN=$token" | Set-Content .env
# Перезапустите сервер
```

### 2.4 В `lab.out.log` — `RangeError: Maximum call stack size exceeded`

Это **известный баг в `@modelcontextprotocol/sdk@1.29.0`** (upstream issue). Срабатывает при teardown транспорта в тестах и при некоторых завершениях MCP-сессий.

**Что происходит:** handler в `src/server/app.ts` ловит ошибку и пишет в audit log.
**Влияние на работу:** **никакого** — тесты всё равно проходят, сервер продолжает работать. Можно игнорировать.
**Долгосрочный фикс:** обновить SDK, когда upstream починит. Следите за [@modelcontextprotocol/sdk releases](https://github.com/modelcontextprotocol/typescript-sdk/releases).

---

## 3. Тунель

### 3.1 Cloudflare: "Не удалось загрузить туннели" в ChatGPT

**Причина 1:** Токен в Cloudflare dashboard не привязан к конкретному тунелю, или скопирован с пробелами.
**Фикс:** Перейдите в https://one.dash.cloudflare.com/ → Networks → Tunnels → ваш тунель → "Configure" → "Install run as a service" или "Install" — скопируйте токен **без обрамляющих пробелов и переносов**.

**Причина 2:** Тунель в дашборде удалён, но `TUNNEL_TOKEN` в `.env` ещё жив.
**Фикс:** Создайте новый тунель, обновите токен.

### 3.2 ngrok: URL меняется при каждом перезапуске

Это **нормально** для бесплатного ngrok. URL пересоздаётся при перезапуске процесса ngrok. Решения:
- **Платный ngrok** ($8/мес) — фиксированный поддомен.
- **Cloudflare Tunnel** — бесплатно, фиксированный URL, требует домен.
- **VPS** — `$5-10/мес`, полный контроль.

### 3.3 Cloudflare: "Error 1033: Tunnel is offline"

**Причина:** процесс `cloudflared` упал или не успел подключиться.
**Фикс:**
```powershell
# Посмотреть лог
Get-Content C:\anotator8-chatgpt-integration-lab\cloudflared.err.log -Tail 30

# Перезапустить
Stop-Process -Name cloudflared -Force -ErrorAction SilentlyContinue
$env:TUNNEL_TOKEN = "..."
cloudflared tunnel run
```

### 3.4 ngrok: "tunnel session failed: could not register"

**Причина:** превышен лимит бесплатного ngrok (1 активный тунель) или `authtoken` не настроен.
**Фикс:**
```powershell
ngrok config add-authtoken <ваш_токен>
# Закройте все окна ngrok
Stop-Process -Name ngrok -Force
ngrok http 8787
```

---

## 4. ChatGPT-сторона

### 4.1 ChatGPT пишет "Can't reach server" при создании коннектора

**Диагностика (делайте в указанном порядке):**

```powershell
# 1. Лаб жив?
curl http://127.0.0.1:8787/health
# (если есть /health endpoint) или
curl http://127.0.0.1:8787/mcp
# Должен вернуть 4xx (нужен JSON-RPC), но не connection refused

# 2. Тунель жив?
curl https://<ваш-тунель>/.well-known/oauth-protected-resource/mcp
# Должен вернуть JSON с полем "resource"

# 3. URL в форме ChatGPT совпадает?
# В форме должно быть: https://<тунель>/mcp (с /mcp на конце!)
```

**Частые причины:**
- Забыли `/mcp` в конце URL
- Тунель указывает на старый/неправильный порт
- Cloudflare/ngrok на free-плане имеет rate limit — ChatGPT-сессия превысила

### 4.2 ChatGPT: OAuth-окно открылось, но потом "redirect failed"

**Причина 1:** `redirect_uri` в OAuth-запросе не совпадает с тем, что в `.env` как `MCP_OAUTH_REDIRECT_URIS` (по умолчанию `chatgpt.com,chat.openai.com`).
**Фикс:** Не трогайте, если не правили.

**Причина 2:** Браузер блокирует third-party cookies (Chrome 2024+, Safari).
**Фикс:** Включите cookies для `chatgpt.com` или используйте режим инкогнито.

**Причина 3:** Cloudflare/ngrok на free-плане не поддерживает HTTPS с валидным сертификатом для вашего домена.
**Фикс:** проверьте, что URL начинается с `https://` (не `http://`) и сертификат валидный (замочек в браузере).

### 4.3 Коннектор создался, но в чате ChatGPT говорит "I can't see the tools"

**Причина:** Developer mode не включён **в этом аккаунте**.
**Фикс:**
1. ChatGPT → Settings → Apps & Connectors → Advanced settings → **Developer mode = ON**
2. Выйдите и зайдите снова (на некоторых платформах)
3. Проверьте, что у вас **Plus/Pro/Team/Enterprise/Edu** (на free Developer mode доступен, но Apps могут быть ограничены)

### 4.4 ChatGPT вызывает tool, но получает "Tool result is missing"

**Причина 1:** Сервер не успевает ответить (таймаут).
**Фикс:** В `.env` поднимите `MCP_HTTP_TIMEOUT_MS=30000` (по умолчанию 10000).

**Причина 2:** Загруженный проект слишком большой.
**Фикс:** Используйте `fixtureId: "sample-project"` для теста. Для большого проекта (>10MB) — лимит `10 MB` в `src/server/errors.ts` (константа `MAX_INPUT_BYTES`); поднимите при необходимости.

**Причина 3:** MCP SDK 1.29.0 рекурсия поймала teardown.
**Фикс:** см. §2.4. Это **не** причина потери ответа tool-а, но может проявляться рядом.

### 4.5 Виджет в чате не отрисовывается

**Причина 1:** Apps SDK не подключился (только `window.openai` legacy bridge активен).
**Фикс:** обновите ChatGPT до последней версии (Apps SDK 2026-01-26 поддерживается в ChatGPT с ноября 2025).

**Причина 2:** В iframe заблокированы ресурсы (CSP).
**Фикс:** проверьте, что URL в ChatGPT = URL, отвечающий 200 на `/.well-known/...` запросы. CSP виджета (`script-src 'self' 'unsafe-inline'`, без `connect-src` к внешним доменам) намеренно строгий.

---

## 5. Безопасность

### 5.1 Случайно закоммитил `.env` в git

**Немедленно:**
1. Смените `MCP_AUTH_TOKEN` и **все** OAuth-секреты.
2. Удалите файл из истории: `git filter-repo --invert-paths --path .env` (или `bfg-repo-cleaner`).
3. Force-push (если знаете, что делаете) или попросите мейнтейнера сделать это.

**Превентивно:** `.gitignore` уже содержит `.env`. Проверьте: `git check-ignore -v .env` → должен ответить `.gitignore:1:.env`.

### 5.2 Виджет видит проект, а я не хочу его отдавать

Лаб **не отправляет** проект ChatGPT автоматически. Вы отправляете его сами одной из команд:
- `inspect_project` с `projectData: <ваш JSON>` (отправляется в каждом вызове)
- `fixtureId: "sample-project"` (используется встроенная безопасная фикстура, ничего из вашего диска не уходит)

**Что ChatGPT видит:**
- То, что вы явно передали в `projectData`.
- Результат каждого tool-call (включая `inspect_project` → нормализованную сводку).

**Что ChatGPT НЕ видит:**
- Файлы на вашем диске (видео, исходный JSON, .anotator файлы).
- Окружение (Anotator8, ваш аккаунт на cloudflare, прочее).

**Если не хотите, чтобы ChatGPT видел проект:**
- Используйте **только** `fixtureId: "sample-project"` для тестов.
- Для реальных данных — отправляйте **только** нормализованный/санитизированный JSON, не оригинал.

---

## 6. Диагностические команды (собираем всё в кучу)

```powershell
# 1. Лаб жив?
curl http://127.0.0.1:8787/.well-known/oauth-protected-resource/mcp

# 2. Тунель жив?
curl https://<ваш-тунель>/.well-known/oauth-protected-resource/mcp

# 3. Полный MCP roundtrip снаружи
$url = "https://<ваш-тунель>/mcp"
$body = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"diag","version":"1"}}}'
curl -X POST $url -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d $body

# 4. Версии
node --version
npm --version
git --version
(Get-Content C:\anotator8-chatgpt-integration-lab\package.json | ConvertFrom-Json).version

# 5. Проверить, что нет шпиона
rg -n "child_process|exec\(|spawn\(" C:\anotator8-chatgpt-integration-lab\src\server
# Должен быть пустой

# 6. Логи
Get-Content C:\anotator8-chatgpt-integration-lab\lab.out.log -Tail 20
Get-Content C:\anotator8-chatgpt-integration-lab\lab.err.log -Tail 20
Get-Content C:\anotator8-chatgpt-integration-lab\cloudflared.err.log -Tail 20
```

Если после всех шагов проблема не ясна — откройте issue с приложенными логами и выводом `npm test`.
