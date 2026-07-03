param(
  [string]$ProjectRoot = "C:\SNIPERBO"
)

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = ($ProjectRoot -replace '"', '').Trim().TrimEnd('\')
if (-not $ProjectRoot) {
  $ProjectRoot = Split-Path -Parent $ScriptDir
}
$LocalEnv = Join-Path $ScriptDir "official_publisher.local.env"
$ProjectEnv = Join-Path $ProjectRoot ".env"
$PubLog = Join-Path $ProjectRoot "official_dashboard_publisher.log"
$ColLog = Join-Path $ProjectRoot "official_legacy_collector.log"
$BridgeLog = Join-Path $ProjectRoot "legacy_collector_bridge.log"

function Read-EnvFile($Path) {
  $values = @{}
  if (-not (Test-Path -LiteralPath $Path)) { return $values }
  $raw = [System.IO.File]::ReadAllText($Path)
  if ($raw.Length -gt 0 -and [int][char]$raw[0] -eq 0xFEFF) {
    $raw = $raw.Substring(1)
  }
  $raw -split "`r?`n" | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) { return }
    $parts = $line.Split("=", 2)
    $values[$parts[0].Trim()] = $parts[1].Trim().Trim('"').Trim("'")
  }
  return $values
}

function Resolve-LocalDashboardToken($LocalValues, $ProjectValues, $LegacyValues) {
  foreach ($source in @($LocalValues, $ProjectValues, $LegacyValues)) {
    foreach ($key in @("SNIPER_LOCAL_DASHBOARD_TOKEN", "SNIPER_ADMIN_TOKEN", "SNIPER_DASHBOARD_TOKEN")) {
      if ($source[$key]) { return $source[$key] }
    }
  }
  return ""
}

function Find-ConfigJson($Root) {
  $candidates = @(
    (Join-Path $Root "config.json"),
    (Join-Path $Root "Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior\config.json"),
    "C:\Users\Usuario\OneDrive\Documentos\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior\config.json",
    "C:\Users\$env:USERNAME\OneDrive\Documentos\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior\config.json"
  ) | Select-Object -Unique
  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) { return $candidate }
  }
  return ""
}

function Test-DashboardUrl($Url, $Token, $Email, $Password) {
  $headers = @{ Accept = "application/json" }
  if ($Token) { $headers.Authorization = "Bearer $Token" }
  if ($Email) { $headers["x-sniper-admin-email"] = $Email }
  if ($Password) { $headers["x-sniper-admin-password"] = $Password }
  try {
    $response = Invoke-RestMethod -Uri $Url -Headers $headers -TimeoutSec 5
    return [pscustomobject]@{ Ok = $true; StatusCode = 200; Body = $response; Error = "" }
  } catch {
    $statusCode = 0
    if ($_.Exception.Response) {
      try { $statusCode = [int]$_.Exception.Response.StatusCode } catch { }
    }
    return [pscustomobject]@{
      Ok = $false
      StatusCode = $statusCode
      Body = $null
      Error = $_.Exception.Message
    }
  }
}

Write-Host ""
Write-Host "=== DIAGNOSTICO SNIPERBO ===" -ForegroundColor Cyan
Write-Host "Pasta: $ProjectRoot"
Write-Host ""

$envValues = Read-EnvFile $LocalEnv
$projectValues = Read-EnvFile $ProjectEnv
$legacyRoot = Join-Path $ProjectRoot "Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior"
$legacyValues = Read-EnvFile (Join-Path $legacyRoot ".env")
$token = Resolve-LocalDashboardToken $envValues $projectValues $legacyValues
$email = $envValues["SNIPER_ADMIN_EMAIL"]
$password = $envValues["SNIPER_ADMIN_PASSWORD"]
$localUrl = if ($envValues["SNIPER_LOCAL_DASHBOARD_URL"]) { $envValues["SNIPER_LOCAL_DASHBOARD_URL"] } else { "http://127.0.0.1:8791/dashboard" }
$collectorUrl = "http://127.0.0.1:8791/dashboard"
$signalsUrl = "http://127.0.0.1:8787/dashboard"

Write-Host "--- Arquivos ---" -ForegroundColor Yellow
$configPath = Join-Path $ProjectRoot "config.json"
$configFound = Find-ConfigJson $ProjectRoot
@(
  "sniper_bo_scraper.py",
  "config.json",
  "scripts\official_dashboard_publisher.py",
  "official_dashboard_publisher.log"
) | ForEach-Object {
  $p = Join-Path $ProjectRoot $_
  if (Test-Path -LiteralPath $p) { Write-Host "[OK] $_" -ForegroundColor Green }
  elseif ($_ -eq "config.json" -and $configFound) {
    Write-Host "[FALTA] config.json em $ProjectRoot" -ForegroundColor Red
    Write-Host "        Encontrado em: $configFound" -ForegroundColor Yellow
    Write-Host "        Copie para: $configPath" -ForegroundColor Yellow
  }
  else { Write-Host "[FALTA] $_" -ForegroundColor Red }
}

Write-Host ""
Write-Host "--- Processos ---" -ForegroundColor Yellow
$py = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
  $_.Name -match "python" -and $_.CommandLine -match "sniper_bo_scraper|official_dashboard_publisher"
})
if ($py.Count -gt 0) {
  $scrapers = @($py | Where-Object { $_.CommandLine -match "sniper_bo_scraper" })
  $publishers = @($py | Where-Object { $_.CommandLine -match "official_dashboard_publisher" })
  if ($scrapers.Count -gt 1) {
    Write-Host "[AVISO] $($scrapers.Count) coletores rodando (deveria ser 1). Rode REINICIAR_SINAIS.bat" -ForegroundColor Yellow
  }
  if ($publishers.Count -gt 2) {
    Write-Host "[AVISO] $($publishers.Count) publishers rodando (esperado: bridge + oficial). Rode REINICIAR_SINAIS.bat" -ForegroundColor Yellow
  }
  $py | ForEach-Object {
    $label = if ($_.CommandLine -match "legacy_collector_bridge") { "bridge" }
             elseif ($_.CommandLine -match "official_dashboard_publisher") { "publisher" }
             else { "coletor" }
    Write-Host "[OK] $label pid=$($_.ProcessId)" -ForegroundColor Green
    Write-Host "     $($_.CommandLine)"
  }
} else {
  Write-Host "[FALTA] Nenhum python do coletor/publisher rodando" -ForegroundColor Red
}

Write-Host ""
Write-Host "--- Coletor mesa (:8791) ---" -ForegroundColor Yellow
$collector = Test-DashboardUrl $collectorUrl $token $email $password
if ($collector.Ok) {
  $rounds = @($collector.Body.rounds)
  Write-Host "Rodadas: $($rounds.Count)" -ForegroundColor Green
  if ($rounds.Count -gt 0) {
    $last = $rounds[-1]
    Write-Host "Ultima rodada: id=$($last.id) result=$($last.result) at=$($last.recordedAt)"
  }
  $sig = $collector.Body.currentSignal
  Write-Host "Sinal motor: side=$($sig.side) status=$($sig.status) id=$($sig.id)"
  $neural = $collector.Body.neuralReading
  if ($neural) {
    Write-Host "Neural: mode=$($neural.mode) status=$($neural.paganteStatus) dir=$($neural.direcao)"
  }
} else {
  Write-Host "ERRO coletor: $($collector.Error)" -ForegroundColor Red
  if ($collector.StatusCode -eq 401) {
    Write-Host "  -> Token desalinhado (401). Rode REINICIAR_SINAIS.bat para reiniciar com JWT atual." -ForegroundColor Yellow
  } elseif ($collector.StatusCode -eq 0) {
    Write-Host "  -> Coletor offline na porta 8791. Chrome/mesa fechados ou config.json faltando." -ForegroundColor Yellow
  } else {
    Write-Host "  -> HTTP $($collector.StatusCode). Verifique log: $ColLog" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "--- Bridge local (:8787) ---" -ForegroundColor Yellow
$bridge = Test-DashboardUrl $signalsUrl $token $email $password
if ($bridge.Ok) {
  $rounds = @($bridge.Body.rounds)
  Write-Host "Rodadas no bridge: $($rounds.Count)" -ForegroundColor Green
  $sig = $bridge.Body.currentSignal
  Write-Host "Sinal no bridge: side=$($sig.side) status=$($sig.status)"
} else {
  Write-Host "Bridge offline ou sem auth: $($bridge.Error)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "--- Site producao ---" -ForegroundColor Yellow
$pubEmail = $envValues["SNIPER_ADMIN_EMAIL"]
$pubPassword = $envValues["SNIPER_ADMIN_PASSWORD"]
if (-not $pubEmail) { Write-Host "[AVISO] SNIPER_ADMIN_EMAIL vazio no .env (BOM UTF-8?)" -ForegroundColor Yellow }
if (-not $pubPassword) { Write-Host "[AVISO] SNIPER_ADMIN_PASSWORD vazio no .env (BOM UTF-8?)" -ForegroundColor Yellow }
try {
  $headers = @{ Accept = "application/json"; "User-Agent" = "Mozilla/5.0 SNIPERBO-Official-Publisher/1.0" }
  if ($pubEmail) { $headers["x-sniper-admin-email"] = $pubEmail }
  if ($pubPassword) { $headers["x-sniper-admin-password"] = $pubPassword }
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
Write-Host "Se 401 ou duplicados: REINICIAR_SINAIS.bat" -ForegroundColor Gray
Write-Host "Se config.json falta: copie da pasta Codex para C:\SNIPERBO\" -ForegroundColor Gray
Write-Host ""
