# setup.ps1 — one-shot installer for Anotator8 x ChatGPT integration lab.
#
# Что делает:
#   1. Проверяет PowerShell, Node, npm, git, internet.
#   2. (Опционально) ставит winget/Node если их нет.
#   3. Клонирует репо (если папки нет) или использует существующую.
#   4. Ставит npm-зависимости.
#   5. Генерирует .env с безопасным MCP_AUTH_TOKEN.
#   6. Запускает npm run build.
#   7. Запускает npm test (если пройдено — продолжает).
#   8. Помогает настроить тунель (Cloudflare / ngrok) и печатает готовый URL.
#   9. Печатает инструкцию для ChatGPT.
#
# Использование:
#   powershell -ExecutionPolicy Bypass -File .\setup.ps1
#   powershell -ExecutionPolicy Bypass -File .\setup.ps1 -SkipTunnel  # без тунеля
#   powershell -ExecutionPolicy Bypass -File .\setup.ps1 -LabPath D:\labs\anotator8
#
# Этот скрипт ИДЕМПОТЕНТЕН — можно запускать повторно, он пропустит уже сделанные шаги.

[CmdletBinding()]
param(
    [string]$LabPath = "C:\anotator8-chatgpt-integration-lab",
    [string]$RepoUrl = "https://github.com/void-79/anotator8-chatgpt-integration-lab.git",
    [string]$Tunnel = "cloudflare",  # cloudflare | ngrok | none
    [switch]$SkipTunnel,
    [switch]$SkipTests,
    [switch]$NonInteractive
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# --- helpers ---------------------------------------------------------------

function Write-Step($n, $title) {
    Write-Host ""
    Write-Host "[$n] $title" -ForegroundColor Cyan
}
function Write-Ok($msg)   { Write-Host "    OK  $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    !!  $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "    XX  $msg" -ForegroundColor Red }
function Write-Info($msg) { Write-Host "    --  $msg" -ForegroundColor Gray }

function Test-Command($cmd) {
    $null -ne (Get-Command $cmd -ErrorAction SilentlyContinue)
}

function Read-Host-Default($prompt, $default) {
    if ($NonInteractive) { return $default }
    $v = Read-Host "$prompt [$default]"
    if ([string]::IsNullOrWhiteSpace($v)) { $default } else { $v }
}

function Confirm-Yes($prompt, $defaultYes = $true) {
    if ($NonInteractive) { return $defaultYes }
    $suffix = if ($defaultYes) { "(Y/n)" } else { "(y/N)" }
    $v = Read-Host "$prompt $suffix"
    if ([string]::IsNullOrWhiteSpace($v)) { return $defaultYes }
    return ($v -match "^[yY]")
}

# --- 0. banner -------------------------------------------------------------

Write-Host ""
Write-Host "================================================================" -ForegroundColor Magenta
Write-Host "  Anotator8 x ChatGPT Integration Lab — setup wizard" -ForegroundColor Magenta
Write-Host "  Lab: $LabPath" -ForegroundColor Magenta
Write-Host "  Tunnel: $Tunnel" -ForegroundColor Magenta
Write-Host "================================================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "Этот скрипт:" -ForegroundColor White
Write-Host "  * проверит, что у вас стоит (Node, git, интернет)"
Write-Host "  * склонирует лаб в выбранную папку (если её ещё нет)"
Write-Host "  * установит зависимости, соберёт, прогонет тесты"
Write-Host "  * сгенерирует .env с безопасным токеном"
Write-Host "  * поможет поднять тунель и выдаст готовый URL для ChatGPT"
Write-Host ""
Write-Host "Безопасно: ничего не пишет в Anotator8, не выполняет произвольных команд от вашего имени."
Write-Host ""

# --- 1. prerequisites ------------------------------------------------------

Write-Step "1/9" "Проверка prerequisites"

if ($PSVersionTable.PSVersion.Major -lt 5) {
    Write-Err "PowerShell 5.1+ required, found $($PSVersionTable.PSVersion)"
    exit 1
}
Write-Ok "PowerShell $($PSVersionTable.PSVersion)"

# Internet
try {
    $null = Invoke-WebRequest -Uri "https://registry.npmjs.org" -UseBasicParsing -TimeoutSec 5
    Write-Ok "Internet reachable"
} catch {
    Write-Err "No internet (npm registry unreachable): $_"
    exit 1
}

# git
if (-not (Test-Command git)) {
    Write-Err "git not in PATH. Install from https://git-scm.com/ and re-run."
    exit 1
}
Write-Ok "git $(git --version)"

# node
$needNodeInstall = $false
if (-not (Test-Command node)) {
    Write-Warn "Node.js not found"
    $needNodeInstall = $true
} else {
    $nodeVer = (node --version) -replace '^v', ''
    $nodeMajor = [int]($nodeVer.Split('.')[0])
    if ($nodeMajor -lt 20) {
        Write-Warn "Node.js v$nodeVer is too old (need 20+)"
        $needNodeInstall = $true
    } else {
        Write-Ok "Node $nodeVer"
    }
}

if ($needNodeInstall) {
    if (Test-Command winget) {
        if (Confirm-Yes "Установить Node.js 22 LTS через winget?") {
            winget install --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
            $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
            $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
            $combined = $machinePath + ";" + $userPath
            [System.Environment]::SetEnvironmentVariable("Path", $combined, "Process")
        } else {
            Write-Err "Без Node скрипт не продолжит. Установите вручную: https://nodejs.org/"
            exit 1
        }
    } else {
        Write-Err "winget не найден. Установите Node.js вручную: https://nodejs.org/ (LTS), перезапустите PowerShell, запустите скрипт заново."
        exit 1
    }
}

# npm
if (-not (Test-Command npm)) {
    Write-Err "npm not in PATH (should have come with Node)"
    exit 1
}
Write-Ok "npm $(npm --version)"

# --- 2. clone or reuse -----------------------------------------------------

Write-Step "2/9" "Получить исходники лаба"

if (Test-Path $LabPath) {
    if (Test-Path (Join-Path $LabPath "package.json")) {
        Write-Ok "Папка уже существует, использую её"
    } else {
        Write-Err "$LabPath существует, но не содержит package.json. Удалите или выберите другой путь."
        exit 1
    }
} else {
    if (Confirm-Yes "Склонировать $RepoUrl в $LabPath ?") {
        git clone $RepoUrl $LabPath
    } else {
        Write-Err "Без исходников продолжить нельзя."
        exit 1
    }
}

Set-Location $LabPath
Write-Ok "Working in $LabPath"

# --- 3. .env ---------------------------------------------------------------

Write-Step "3/9" "Сгенерировать .env"

if (Test-Path ".env") {
    Write-Ok ".env уже существует, оставляю как есть"
    $haveToken = $true
} else {
    if (-not (Test-Path ".env.example")) {
        Write-Err ".env.example not found — lab files incomplete"
        exit 1
    }
    Copy-Item ".env.example" ".env"
    Write-Ok "Скопирован .env.example → .env"

    # Сгенерировать MCP_AUTH_TOKEN
    $token = [guid]::NewGuid().Guid + [guid]::NewGuid().Guid
    $lines = Get-Content ".env"
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^\s*#?\s*MCP_AUTH_TOKEN\s*=') {
            $lines[$i] = "MCP_AUTH_TOKEN=$token"
        }
    }
    $lines | Set-Content ".env"
    Write-Ok "MCP_AUTH_TOKEN сгенерирован (64 hex chars). Смените его, если не доверяете генератору."
    $haveToken = $true
}

# Имя коннектора
$connectorName = Read-Host-Default "Имя коннектора в ChatGPT" "Anotator8 Lab"
$lines = Get-Content ".env"
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '^\s*#?\s*MCP_OAUTH_RESOURCE_NAME\s*=') {
        $lines[$i] = "MCP_OAUTH_RESOURCE_NAME=$connectorName"
    }
}
$lines | Set-Content ".env"
Write-Ok "MCP_OAUTH_RESOURCE_NAME=$connectorName"

# --- 4. dependencies -------------------------------------------------------

Write-Step "4/9" "Установить npm-зависимости"

if (Test-Path "node_modules") {
    Write-Ok "node_modules уже есть, пропускаю (для чистой установки удалите папку)"
} else {
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Err "npm install failed (exit $LASTEXITCODE)"
        exit 1
    }
    Write-Ok "npm install done"
}

# --- 5. build --------------------------------------------------------------

Write-Step "5/9" "Сборка TypeScript"
npm run build 2>&1 | Tee-Object -Variable buildOut | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Err "npm run build failed"
    exit 1
}
Write-Ok "build OK"

# --- 6. tests --------------------------------------------------------------

if ($SkipTests) {
    Write-Step "6/9" "Тесты (пропущены по флагу -SkipTests)"
} else {
    Write-Step "6/9" "Прогон тестов (224 unit + integration + contract)"
    npm test 2>&1 | Tee-Object -Variable testOut | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Err "npm test FAILED. Смотрите вывод выше."
        if (-not (Confirm-Yes "Всё равно продолжить?" $false)) { exit 1 }
    } else {
        Write-Ok "tests OK"
    }
}

# --- 7. smoke --------------------------------------------------------------

Write-Step "7/9" "Smoke-проверка (реальный HTTP roundtrip)"
npm run smoke 2>&1 | Tee-Object -Variable smokeOut | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Err "npm run smoke FAILED"
    exit 1
}
Write-Ok "smoke OK"

# --- 8. tunnel -------------------------------------------------------------

$publicUrl = $null

if ($SkipTunnel -or $Tunnel -eq "none") {
    Write-Step "8/9" "Тунель пропущен (SkipTunnel или Tunnel=none)"
    Write-Info "Лаб доступен ТОЛЬКО на $((Get-Content .env) | Select-String '^MCP_HOST=' | ForEach-Object { $_.Line.Split('=')[1] }):$((Get-Content .env) | Select-String '^MCP_PORT=' | ForEach-Object { $_.Line.Split('=')[1] })"
    Write-Info "Для теста в Claude Desktop / Cursor / Cline используйте stdio — см. RUNBOOK.md, раздел 'Путь A' / 'stdio'."
} else {
    Write-Step "8/9" "Настройка тунеля: $Tunnel"

    if ($Tunnel -eq "cloudflare") {
        if (-not (Test-Command cloudflared)) {
            if (Test-Command winget) {
                if (Confirm-Yes "Установить cloudflared через winget?") {
                    winget install --id Cloudflare.cloudflared --accept-source-agreements --accept-package-agreements
                    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
                    $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
                    $combined = $machinePath + ";" + $userPath
                    [System.Environment]::SetEnvironmentVariable("Path", $combined, "Process")
                } else {
                    Write-Warn "Без cloudflared тунель не поднимется. Поставьте вручную: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
                }
            } else {
                Write-Warn "winget не найден. Поставьте cloudflared вручную: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
            }
        }

        if (Test-Command cloudflared) {
            Write-Ok "cloudflared $(cloudflared --version 2>&1 | Select-Object -First 1)"

            Write-Host ""
            Write-Host "    Cloudflare tunnel требует:" -ForegroundColor White
            Write-Host "      1) аккаунт cloudflare.com (бесплатный)"
            Write-Host "      2) домен, добавленный в Cloudflare"
            Write-Host "      3) туннель, созданный в https://one.dash.cloudflare.com/ → Networks → Tunnels"
            Write-Host "      4) TUNNEL_TOKEN из дашборда (длинная строка)"
            Write-Host ""
            $tunnelToken = Read-Host-Default "Вставьте TUNNEL_TOKEN (или Enter чтобы пропустить и запустить лаб в фоне)" ""
            if ([string]::IsNullOrWhiteSpace($tunnelToken)) {
                Write-Warn "TUNNEL_TOKEN не введён — тунель не поднимется, лаб останется на localhost"
            } else {
                Write-Info "Запускаю cloudflared в фоне (токен: $($tunnelToken.Substring(0, 12))...)..."
                $cloudflared = Start-Process -FilePath "cloudflared" -ArgumentList "tunnel","run","--token",$tunnelToken -RedirectStandardOutput "$LabPath\cloudflared.out.log" -RedirectStandardError "$LabPath\cloudflared.err.log" -PassThru -WindowStyle Hidden
                Write-Ok "cloudflared PID = $($cloudflared.Id). Логи: $LabPath\cloudflared.out.log"
                Write-Info "Ждём 5 секунд, пока тунель поднимется..."
                Start-Sleep -Seconds 5

                # Пытаемся достать hostname из лога
                if (Test-Path "$LabPath\cloudflared.out.log") {
                    # Для named tunnel (с токеном) hostname = то, что задан в Cloudflare dashboard
                    $hostname = Select-String -Path "$LabPath\cloudflared.out.log" -Pattern "https://[a-zA-Z0-9.-]+" -AllMatches | ForEach-Object { $_.Matches.Value } | Where-Object { $_ -match '^https://' -and $_ -notmatch 'trycloudflare|cloudflare.com$' } | Select-Object -First 1
                    if ($hostname) {
                        $publicUrl = "$hostname/mcp"
                        Write-Ok "Тунель поднят: $publicUrl"
                    } else {
                        Write-Warn "Не удалось извлечь hostname из лога. Откройте cloudflared.out.log вручную."
                    }
                }
            }
        } else {
            Write-Warn "cloudflared не установлен, пропускаю шаг"
        }

    } elseif ($Tunnel -eq "ngrok") {
        if (-not (Test-Command ngrok)) {
            Write-Warn "ngrok не найден. Скачайте: https://ngrok.com/download, распакуйте, добавьте в PATH"
            $ngrokAuth = Read-Host-Default "Вставьте ngrok authtoken (или Enter чтобы пропустить)" ""
            if (-not [string]::IsNullOrWhiteSpace($ngrokAuth)) {
                ngrok config add-authtoken $ngrokAuth
            }
        }

        if (Test-Command ngrok) {
            $ngrok = Start-Process -FilePath "ngrok" -ArgumentList "http","8787","--log=stdout" -RedirectStandardOutput "$LabPath\ngrok.out.log" -RedirectStandardError "$LabPath\ngrok.err.log" -PassThru -WindowStyle Hidden
            Write-Ok "ngrok PID = $($ngrok.Id). Ждём 4 секунды..."
            Start-Sleep -Seconds 4

            try {
                $tunnels = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 5
                $httpsTunnel = $tunnels.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1
                if ($httpsTunnel) {
                    $publicUrl = "$($httpsTunnel.public_url)/mcp"
                    Write-Ok "ngrok тунель: $publicUrl"
                    Write-Warn "Бесплатный ngrok меняет URL при перезапуске. Для стабильного URL используйте Cloudflare."
                }
            } catch {
                Write-Warn "Не удалось подключиться к ngrok API (http://127.0.0.1:4040). Смотрите ngrok.out.log"
            }
        }
    }
}

# --- 9. start lab server in background -------------------------------------

Write-Step "9/9" "Запуск лаб-сервера в фоне"

$node = Start-Process -FilePath "node" -ArgumentList "dist/server/index.js" -RedirectStandardOutput "$LabPath\lab.out.log" -RedirectStandardError "$LabPath\lab.err.log" -PassThru -WindowStyle Hidden -WorkingDirectory $LabPath
Start-Sleep -Seconds 2

if (Get-Process -Id $node.Id -ErrorAction SilentlyContinue) {
    Write-Ok "Лаб PID = $($node.Id). Логи: $LabPath\lab.out.log"
} else {
    Write-Err "Лаб-сервер не запустился. Смотрите $LabPath\lab.err.log"
    exit 1
}

# --- 10. open connect-helper.html in default browser ----------------------

$helperPath = Join-Path $LabPath "connect-helper.html"
if (Test-Path $helperPath) {
    Write-Step "10/10" "Открываю connect-helper.html в браузере"
    try {
        Start-Process -FilePath $helperPath
        Write-Ok "Connect Helper открыт. Там все значения для ChatGPT — копируй кнопками."
    } catch {
        Write-Warn "Не удалось автоматически открыть connect-helper.html. Открой вручную:"
        Write-Host "  $helperPath" -ForegroundColor Gray
    }
} else {
    Write-Warn "connect-helper.html не найден. Ожидается в: $helperPath"
}

# --- final report ---------------------------------------------------------

Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host "  SETUP COMPLETE" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Lab folder:    $LabPath" -ForegroundColor White
Write-Host "  Lab version:   $((Get-Content package.json | ConvertFrom-Json).version)" -ForegroundColor White
Write-Host "  Lab PID:       $($node.Id) (logs: lab.out.log, lab.err.log)" -ForegroundColor White

if ($publicUrl) {
    Write-Host "  Public URL:    $publicUrl" -ForegroundColor White
} else {
    Write-Host "  Public URL:    (тунель не поднят автоматически)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  Дальше:" -ForegroundColor Cyan
Write-Host ""
if ($publicUrl) {
    Write-Host "  1. Откройте https://chatgpt.com/ в браузере" -ForegroundColor White
    Write-Host "  2. Settings → Apps & Connectors → Advanced settings → Developer mode → ON" -ForegroundColor White
    Write-Host "  3. Settings → Connectors → Create app" -ForegroundColor White
    Write-Host "  4. Заполните форму:" -ForegroundColor White
    Write-Host "       Название:        $connectorName" -ForegroundColor Gray
    Write-Host "       URL сервера:     $publicUrl" -ForegroundColor Gray
    Write-Host "       Аутентификация:  OAuth" -ForegroundColor Gray
    Write-Host "       Чекбокс:         Я понимаю и хочу продолжить" -ForegroundColor Gray
    Write-Host "  5. В чате: + → включите $connectorName → напишите:" -ForegroundColor White
    Write-Host '       "Используй '$connectorName' — сделай inspect_project на fixtureId: sample-project"' -ForegroundColor Gray
} else {
    Write-Host "  1. Настройте тунель вручную (см. RUNBOOK.md, шаг 5)" -ForegroundColor White
    Write-Host "  2. После поднятия тунеля — добавьте коннектор в ChatGPT" -ForegroundColor White
    Write-Host "  3. Для локального теста в Claude Desktop / Cursor / Cline:" -ForegroundColor White
    Write-Host "       command: node" -ForegroundColor Gray
    Write-Host "       args: [\"$LabPath\\dist\\server\\index.js\"]" -ForegroundColor Gray
    Write-Host "       env: { MCP_TRANSPORT: stdio }" -ForegroundColor Gray
}
Write-Host ""
Write-Host "  Остановить:" -ForegroundColor Cyan
Write-Host "    Stop-Process -Id $($node.Id)" -ForegroundColor Gray
Write-Host ""
Write-Host "  Перезапустить заново (идемпотентно):" -ForegroundColor Cyan
Write-Host "    powershell -ExecutionPolicy Bypass -File $PSCommandPath" -ForegroundColor Gray
Write-Host ""
Write-Host "  Подробная документация: $LabPath\RUNBOOK.md" -ForegroundColor Cyan
Write-Host "  Troubleshooting:        $LabPath\TROUBLESHOOTING.md" -ForegroundColor Cyan
Write-Host "  Connect Helper (UI):    $LabPath\connect-helper.html" -ForegroundColor Cyan
Write-Host ""
