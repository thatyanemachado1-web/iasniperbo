param(
  [switch]$Restart,
  [switch]$RunSmoke
)

$ErrorActionPreference = "Continue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$LocalEnvPath = Join-Path $ScriptDir "official_publisher.local.env"
$PublisherLog = Join-Path $ProjectRoot "official_dashboard_publisher.log"
$WatchLog = Join-Path $ProjectRoot "logs\sniperbo_official_watchdog.log"

function Write-Section($Title) {
  Write-Host ""
  Write-Host "=== $Title ===" -ForegroundColor Cyan
}

function Read-LocalEnv($Path) {
  $values = @{}
  if (-not (Test-Path -LiteralPath $Path)) { return $values }
  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) { return }
    $parts = $line.Split("=", 2)
    $values[$parts[0].Trim()] = $parts[1].Trim().Trim('"').Trim("'")
  }
  return $values
}

function Test-TokenPresent($Name, $Value) {
  if ($Value -and $Value.Length -ge 16) {
    Write-Host "  OK  $Name ($($Value.Length) chars)" -ForegroundColor Green
    return $true
  }
  if ($Value) {
    Write-Host "  WARN $Name parece curto ($($Value.Length) chars)" -ForegroundColor Yellow
    return $false
  }
  Write-Host "  FAIL $Name ausente" -ForegroundColor Red
  return $false
}

Write-Section "1) Processos official_dashboard_publisher.py"
$publishers = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -match "official_dashboard_publisher.py" })
if ($publishers.Count -eq 0) {
  Write-Host "Nenhum publisher rodando." -ForegroundColor Red
} elseif ($publishers.Count -eq 1) {
  Write-Host "1 instancia OK pid=$($publishers[0].ProcessId)" -ForegroundColor Green
  Write-Host $publishers[0].CommandLine
} else {
  Write-Host "$($publishers.Count) instancias (duplicata!):" -ForegroundColor Yellow
  $publishers | ForEach-Object { Write-Host "  pid=$($_.ProcessId) $($_.CommandLine)" }
}

Write-Section "2) Ultimas 60 linhas do log"
if (Test-Path -LiteralPath $PublisherLog) {
  Get-Content -LiteralPath $PublisherLog -Tail 60 | ForEach-Object { Write-Host $_ }
  $tail = Get-Content -LiteralPath $PublisherLog -Tail 60 -Raw
  if ($tail -match "Publish HTTP 401|Publish HTTP 403|Nao autorizado|401|403") {
    Write-Host "Detectado possivel erro de auth (401/403) no log." -ForegroundColor Red
  }
  if ($tail -match "Published official dashboard|status_code=200|upload_ms") {
    Write-Host "Detectados POSTs bem-sucedidos recentes." -ForegroundColor Green
  }
  if ($tail -match "Local dashboard|127\.0\.0\.1:8787|Connection refused|Failed to establish") {
    Write-Host "Signals API local (:8787) pode estar offline." -ForegroundColor Yellow
  }
} else {
  Write-Host "Log nao encontrado: $PublisherLog" -ForegroundColor Red
}

Write-Section "3) Variaveis em scripts/official_publisher.local.env"
if (-not (Test-Path -LiteralPath $LocalEnvPath)) {
  Write-Host "Arquivo ausente: $LocalEnvPath" -ForegroundColor Red
  Write-Host "Copie scripts/official_publisher.local.env.example e preencha." -ForegroundColor Yellow
} else {
  $envMap = Read-LocalEnv $LocalEnvPath
  $null = Test-TokenPresent "SNIPER_ADMIN_EMAIL" ($envMap["SNIPER_ADMIN_EMAIL"])
  $null = Test-TokenPresent "SNIPER_ADMIN_PASSWORD" ($envMap["SNIPER_ADMIN_PASSWORD"])
  $adminOk = Test-TokenPresent "SNIPER_ADMIN_TOKEN" ($envMap["SNIPER_ADMIN_TOKEN"])
  $localOk = Test-TokenPresent "SNIPER_LOCAL_DASHBOARD_TOKEN" ($envMap["SNIPER_LOCAL_DASHBOARD_TOKEN"])
  $pubOk = Test-TokenPresent "SNIPER_PUBLISHER_TOKEN" ($envMap["SNIPER_PUBLISHER_TOKEN"])
  $remoteOk = Test-TokenPresent "SNIPER_REMOTE_DASHBOARD_TOKEN" ($envMap["SNIPER_REMOTE_DASHBOARD_TOKEN"])
  if (-not $adminOk) {
    Write-Host ""
    Write-Host "Renovar SNIPER_ADMIN_TOKEN:" -ForegroundColor Yellow
    Write-Host "  1. Login em https://sniperbo.com/app/admin"
    Write-Host "  2. F12 > Application > Local Storage > sniper_admin_session"
    Write-Host "  3. Copie o campo JSON 'token' para SNIPER_ADMIN_TOKEN no .local.env"
    Write-Host "  4. SNIPER_PUBLISHER_TOKEN deve ser o mesmo valor configurado no Cloudflare Workers"
  }
}

Write-Section "4) Signals API local (:8787)"
try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:8787/health" -TimeoutSec 3
  Write-Host "Signals API online: $($health.status) port=$($health.port)" -ForegroundColor Green
} catch {
  Write-Host "Signals API OFFLINE em :8787 - publisher nao consegue ler dashboard local." -ForegroundColor Red
  Write-Host "Rode: powershell -ExecutionPolicy Bypass -File .\scripts\start_official_signals_api.ps1"
}

Write-Section "5) Producao sniperbo.com (diagnostics)"
try {
  $token = $envMap["SNIPER_ADMIN_TOKEN"]
  if (-not $token) { $token = $envMap["SNIPER_PUBLISHER_TOKEN"] }
  if ($token) {
    $headers = @{ Accept = "application/json"; Authorization = "Bearer $token" }
    $diag = Invoke-RestMethod -Uri "https://sniperbo.com/telegram/v2/diagnostics" -Headers $headers -TimeoutSec 10
    Write-Host "diagnostics OK" -ForegroundColor Green
    $diag | ConvertTo-Json -Depth 4
  } else {
    Write-Host "Sem token local para testar diagnostics (401 esperado)." -ForegroundColor Yellow
  }
} catch {
  Write-Host "diagnostics falhou: $($_.Exception.Message)" -ForegroundColor Red
}

if ($Restart) {
  Write-Section "6) Reiniciando publisher + watchdog"
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match "official_dashboard_publisher.py" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 1
  & (Join-Path $ScriptDir "start_official_publisher.ps1")
  & (Join-Path $ScriptDir "watch_sniperbo_official.ps1") -Once
  Start-Sleep -Seconds 10
  Write-Section "7) Log apos reinicio (20 linhas)"
  if (Test-Path -LiteralPath $PublisherLog) {
    Get-Content -LiteralPath $PublisherLog -Tail 20 | ForEach-Object { Write-Host $_ }
  }
}

if ($RunSmoke) {
  Write-Section "8) Smoke test producao"
  $token = $envMap["SNIPER_ADMIN_TOKEN"]
  if (-not $token) { $token = $envMap["SNIPER_PUBLISHER_TOKEN"] }
  if (-not $token) {
    Write-Host "Defina SNIPER_ADMIN_TOKEN no .local.env antes do smoke test." -ForegroundColor Red
  } else {
    $env:SNIPER_ADMIN_TOKEN = $token
    Push-Location $ProjectRoot
    node .\scripts\telegram-v2-prod-smoke.mjs
    Pop-Location
  }
}

Write-Section "Criterio de sucesso"
Write-Host "- 1 processo python official_dashboard_publisher.py"
Write-Host "- Log: Published official dashboard / POST 200 ~ a cada 0.7s"
Write-Host "- diagnostics retorna JSON atualizado (com token valido)"
Write-Host "- Telegram teste dispara apos rodada nova"
Write-Host ""
Write-Host "Comando completo (diagnostico + restart + smoke):"
Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\diagnose_official_publisher.ps1 -Restart -RunSmoke"
