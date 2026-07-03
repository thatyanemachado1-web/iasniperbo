param(
  [string]$ProjectRoot = "C:\SNIPERBO"
)

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $ProjectRoot) { $ProjectRoot = Split-Path -Parent $ScriptDir }
$LocalEnv = Join-Path $ScriptDir "official_publisher.local.env"
$PubLog = Join-Path $ProjectRoot "official_dashboard_publisher.log"
$ColLog = Join-Path $ProjectRoot "official_legacy_collector.log"
$BridgeLog = Join-Path $ProjectRoot "legacy_collector_bridge.log"

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

Write-Host ""
Write-Host "=== DIAGNOSTICO SNIPERBO ===" -ForegroundColor Cyan
Write-Host "Pasta: $ProjectRoot"
Write-Host ""

$envValues = Read-EnvFile $LocalEnv
$token = $envValues["SNIPER_ADMIN_TOKEN"]
$email = $envValues["SNIPER_ADMIN_EMAIL"]
$password = $envValues["SNIPER_ADMIN_PASSWORD"]
$localUrl = if ($envValues["SNIPER_LOCAL_DASHBOARD_URL"]) { $envValues["SNIPER_LOCAL_DASHBOARD_URL"] } else { "http://127.0.0.1:8791/dashboard" }

Write-Host "--- Arquivos ---" -ForegroundColor Yellow
@(
  "sniper_bo_scraper.py",
  "config.json",
  "scripts\official_dashboard_publisher.py",
  "official_dashboard_publisher.log"
) | ForEach-Object {
  $p = Join-Path $ProjectRoot $_
  if (Test-Path -LiteralPath $p) { Write-Host "[OK] $_" -ForegroundColor Green }
  else { Write-Host "[FALTA] $_" -ForegroundColor Red }
}

Write-Host ""
Write-Host "--- Processos ---" -ForegroundColor Yellow
$py = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
  $_.Name -match "python" -and $_.CommandLine -match "sniper_bo_scraper|official_dashboard_publisher"
}
if ($py) {
  $py | ForEach-Object { Write-Host "[OK] $($_.Name) pid=$($_.ProcessId)"; Write-Host "     $($_.CommandLine)" }
} else {
  Write-Host "[FALTA] Nenhum python do coletor/publisher rodando" -ForegroundColor Red
}

Write-Host ""
Write-Host "--- Coletor local ($localUrl) ---" -ForegroundColor Yellow
try {
  $headers = @{ Accept = "application/json" }
  if ($token) { $headers.Authorization = "Bearer $token" }
  if ($email) { $headers["x-sniper-admin-email"] = $email }
  if ($password) { $headers["x-sniper-admin-password"] = $password }
  $local = Invoke-RestMethod -Uri $localUrl -Headers $headers -TimeoutSec 5
  $rounds = @($local.rounds)
  Write-Host "Rodadas: $($rounds.Count)" -ForegroundColor Green
  if ($rounds.Count -gt 0) {
    $last = $rounds[-1]
    Write-Host "Ultima rodada: id=$($last.id) result=$($last.result) at=$($last.recordedAt)"
  }
  $sig = $local.currentSignal
  Write-Host "Sinal motor: side=$($sig.side) status=$($sig.status) id=$($sig.id)"
  $neural = $local.neuralReading
  if ($neural) {
    Write-Host "Neural: mode=$($neural.mode) status=$($neural.paganteStatus) dir=$($neural.direcao)"
  }
} catch {
  Write-Host "ERRO coletor: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "  -> Coletor NAO responde na porta 8791. Chrome/mesa parados ou config.json faltando." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "--- Site producao ---" -ForegroundColor Yellow
try {
  $headers = @{ Accept = "application/json"; "User-Agent" = "sniperbo-official-publisher/1.0" }
  if ($email) { $headers["x-sniper-admin-email"] = $email }
  if ($password) { $headers["x-sniper-admin-password"] = $password }
  $pub = Invoke-RestMethod -Uri "https://sniperbo.com/dashboard/publish" -Method POST -Headers $headers -ContentType "application/json" -Body '{"probe":true}' -TimeoutSec 10
  $dash = $pub.dashboard
  $sig = $dash.currentSignal
  Write-Host "Publish OK. Rodadas no site: $(@($dash.rounds).Count)"
  Write-Host "Sinal no site: side=$($sig.side) status=$($sig.status)"
  Write-Host "updatedAt=$($dash.updatedAt)"
} catch {
  Write-Host "ERRO publish: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "--- Log publisher (ultimas 8 linhas) ---" -ForegroundColor Yellow
if (Test-Path -LiteralPath $PubLog) {
  Get-Content -LiteralPath $PubLog -Tail 8 | ForEach-Object { Write-Host "  $_" }
} else {
  Write-Host "  Log nao encontrado"
}

Write-Host ""
Write-Host "--- Log coletor (ultimas 5 linhas) ---" -ForegroundColor Yellow
if (Test-Path -LiteralPath $ColLog) {
  Get-Content -LiteralPath $ColLog -Tail 5 | ForEach-Object { Write-Host "  $_" }
} elseif (Test-Path -LiteralPath $BridgeLog) {
  Get-Content -LiteralPath $BridgeLog -Tail 5 | ForEach-Object { Write-Host "  $_" }
} else {
  Write-Host "  Log coletor nao encontrado"
}

Write-Host ""
Write-Host "=== FIM ===" -ForegroundColor Cyan
Write-Host ""
