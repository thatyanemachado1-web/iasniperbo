# Ligar sinais SNIPERBO — um comando só
# Uso: powershell -ExecutionPolicy Bypass -File scripts\ligar_sinais.ps1

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$LocalEnv = Join-Path $ScriptDir "official_publisher.local.env"
$EnvExample = Join-Path $ScriptDir "official_publisher.local.env.example"

function Read-EnvFile($Path) {
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

Set-Location $ProjectRoot

Write-Host ""
Write-Host "=== SNIPERBO — Ligando motor real de sinais ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path -LiteralPath $LocalEnv)) {
  if (-not (Test-Path -LiteralPath $EnvExample)) {
    throw "Arquivo de exemplo ausente: $EnvExample"
  }
  Copy-Item -LiteralPath $EnvExample -Destination $LocalEnv
  Write-Host "Criado $LocalEnv — preencha SNIPER_ADMIN_EMAIL e SNIPER_ADMIN_PASSWORD, depois rode de novo." -ForegroundColor Yellow
  exit 1
}

$localValues = Read-EnvFile $LocalEnv
$configScript = Join-Path $ScriptDir "configurar_publisher_credenciais.ps1"
if ((Test-Path -LiteralPath $configScript) -and $localValues["SNIPER_ADMIN_PASSWORD"]) {
  Write-Host "[0/3] Atualizando JWT via login admin..." -ForegroundColor Green
  & $configScript `
    -AdminEmail ($localValues["SNIPER_ADMIN_EMAIL"]) `
    -AdminPassword ($localValues["SNIPER_ADMIN_PASSWORD"]) `
    -LocalDashboardUrl ($localValues["SNIPER_LOCAL_DASHBOARD_URL"])
}

$missing = @()
foreach ($key in @("SNIPER_ADMIN_EMAIL", "SNIPER_ADMIN_PASSWORD", "SNIPER_ADMIN_TOKEN")) {
  $values = Read-EnvFile $LocalEnv
  if (-not $values[$key]) { $missing += $key }
}
if ($missing.Count -gt 0) {
  Write-Host "Variaveis vazias em official_publisher.local.env:" -ForegroundColor Red
  $missing | ForEach-Object { Write-Host "  $_" }
  exit 1
}

Write-Host "[1/3] Coletor + bridge (8791 -> 8787)..." -ForegroundColor Green
& (Join-Path $ScriptDir "start_legacy_collector_bridge.ps1") -Quiet

Write-Host "[2/3] Publisher oficial (local -> sniperbo.com)..." -ForegroundColor Green
& (Join-Path $ScriptDir "start_official_publisher.ps1") -Quiet

Write-Host "[3/3] Watchdog (mantem tudo vivo)..." -ForegroundColor Green
$watchdog = Join-Path $ScriptDir "watch_sniperbo_official.ps1"
if (Test-Path -LiteralPath $watchdog) {
  Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$watchdog`"" -WindowStyle Hidden
  Write-Host "Watchdog iniciado em background." -ForegroundColor Green
}

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "=== Status ===" -ForegroundColor Cyan
try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:8787/health" -TimeoutSec 3
  Write-Host "Signals API: $($health.status) porta $($health.port)" -ForegroundColor Green
} catch {
  Write-Host "Signals API: OFFLINE — rode npm run build && scripts\start_official_signals_api.ps1" -ForegroundColor Red
}

try {
  $legacy = Read-EnvFile $LocalEnv
  $legacyUrl = if ($legacy["SNIPER_LOCAL_DASHBOARD_URL"]) { $legacy["SNIPER_LOCAL_DASHBOARD_URL"] } else { "http://127.0.0.1:8791/dashboard" }
  $legacyBase = $legacyUrl -replace "/dashboard$", ""
  Invoke-RestMethod -Uri "$legacyBase/health" -TimeoutSec 3 | Out-Null
  Write-Host "Coletor legacy: online ($legacyBase)" -ForegroundColor Green
} catch {
  Write-Host "Coletor legacy: aguardando Chrome/mesa (porta 8791)" -ForegroundColor Yellow
}

$pubLog = Join-Path $ProjectRoot "official_dashboard_publisher.log"
if (Test-Path -LiteralPath $pubLog) {
  Write-Host ""
  Write-Host "Ultimas linhas do publisher:" -ForegroundColor Cyan
  Get-Content -LiteralPath $pubLog -Tail 5 | ForEach-Object { Write-Host "  $_" }
}

Write-Host ""
Write-Host "Site: https://sniperbo.com/app" -ForegroundColor Cyan
Write-Host "Log publisher: $pubLog" -ForegroundColor Gray
Write-Host ""
