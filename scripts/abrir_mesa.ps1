$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$DestConfig = Join-Path $ProjectRoot "config.json"
$Scraper = Join-Path $ProjectRoot "sniper_bo_scraper.py"
$LocalEnv = Join-Path $ScriptDir "official_publisher.local.env"
$LogFile = Join-Path $ProjectRoot "official_legacy_collector.log"

function Read-EnvFile($Path) {
  $values = @{}
  if (-not (Test-Path -LiteralPath $Path)) { return $values }
  $raw = [System.IO.File]::ReadAllText($Path)
  if ($raw.Length -gt 0 -and [int][char]$raw[0] -eq 0xFEFF) { $raw = $raw.Substring(1) }
  $raw -split "`r?`n" | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) { return }
    $parts = $line.Split("=", 2)
    $values[$parts[0].Trim()] = $parts[1].Trim().Trim('"').Trim("'")
  }
  return $values
}

function Test-ConfigIsSuper($Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return $false }
  try {
    $text = [System.IO.File]::ReadAllText($Path).ToLowerInvariant()
    if ($text -match "77super|browser_profile_77super") { return $true }
    if ($text -match "score\.|cassino.?score|casino.?score") { return $false }
    return $true
  } catch {
    return $false
  }
}

function Find-ConfigJson {
  $gerar = Join-Path $ScriptDir "gerar_config_super.ps1"
  if (Test-Path -LiteralPath $DestConfig) {
    if (Test-ConfigIsSuper $DestConfig) { return $DestConfig }
    Write-Host "[AVISO] config.json atual NAO e da Casa Super. Recriando..." -ForegroundColor Yellow
    Remove-Item -LiteralPath $DestConfig -Force -ErrorAction SilentlyContinue
  }
  $roots = @(
    $ProjectRoot,
    (Join-Path $ProjectRoot "Codex"),
    "C:\Users\Usuario\OneDrive\Documentos\Codex",
    "C:\Users\$env:USERNAME\OneDrive\Documentos\Codex",
    "C:\Codex"
  ) | Select-Object -Unique
  foreach ($root in $roots) {
    if (-not (Test-Path -LiteralPath $root)) { continue }
    try {
      $found = Get-ChildItem -LiteralPath $root -Filter "config.json" -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch "\\node_modules\\" -and (Test-ConfigIsSuper $_.FullName) } |
        Select-Object -First 1
      if ($found) {
        Copy-Item -LiteralPath $found.FullName -Destination $DestConfig -Force
        Write-Host "[OK] config.json Casa Super copiado de:" $found.FullName -ForegroundColor Green
        return $DestConfig
      }
    } catch { }
  }
  if (Test-Path -LiteralPath $gerar) {
    & $gerar
    if (Test-Path -LiteralPath $DestConfig) { return $DestConfig }
  }
  return ""
}

function Find-Python {
  $candidates = @(
    (Join-Path $ProjectRoot "Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior\.venv\Scripts\python.exe"),
    (Join-Path $ProjectRoot ".venv\Scripts\python.exe"),
    "C:\Users\Usuario\OneDrive\Documentos\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior\.venv\Scripts\python.exe",
    "C:\Users\$env:USERNAME\OneDrive\Documentos\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior\.venv\Scripts\python.exe"
  )
  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) { return $candidate }
  }
  return "python.exe"
}

Write-Host ""
Write-Host "=== SNIPERBO - Abrindo mesa Bac Bo (Casa Super) ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path -LiteralPath $Scraper)) {
  Write-Host "[ERRO] Falta sniper_bo_scraper.py em $ProjectRoot" -ForegroundColor Red
  Write-Host "       Pecaa quem instalou antes para enviar esse arquivo." -ForegroundColor Yellow
  exit 1
}

$config = Find-ConfigJson
if (-not $config) {
  Write-Host "[ERRO] config.json NAO encontrado no PC." -ForegroundColor Red
  Write-Host ""
  Write-Host "  Esse arquivo abre a mesa no Chrome. Sem ele a mesa NAO abre." -ForegroundColor Yellow
  Write-Host "  Procure config.json na pasta Codex e copie para:" -ForegroundColor Yellow
  Write-Host "  $DestConfig" -ForegroundColor White
  Write-Host ""
  $codex = Join-Path $ProjectRoot "Codex"
  if (Test-Path -LiteralPath $codex) {
    Write-Host "  Abrindo pasta Codex para voce procurar..." -ForegroundColor Cyan
    Start-Process explorer.exe $codex
  }
  exit 1
}

$envValues = Read-EnvFile $LocalEnv
$token = $envValues["SNIPER_LOCAL_DASHBOARD_TOKEN"]
if (-not $token) { $token = $envValues["SNIPER_ADMIN_TOKEN"] }

Write-Host "[1/3] Parando coletores antigos..." -ForegroundColor Yellow
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*sniper_bo_scraper.py*" } |
  ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
Start-Sleep -Seconds 2

$python = Find-Python
Write-Host "[2/3] Abrindo Chrome com mesa Bac Bo..." -ForegroundColor Green
Write-Host "      Python: $python" -ForegroundColor Gray
Write-Host "      Aguarde o Chrome abrir (30 a 60 segundos)." -ForegroundColor Gray
Write-Host ""

$argList = @(
  "`"$Scraper`"",
  "--config", "`"$config`"",
  "--interval", "0.5",
  "--admin-api-enabled",
  "--no-telegram",
  "--log-file", "`"$LogFile`""
) -join " "

$pinfo = New-Object System.Diagnostics.ProcessStartInfo
$pinfo.FileName = $python
$pinfo.Arguments = $argList
$pinfo.WorkingDirectory = $ProjectRoot
$pinfo.UseShellExecute = $false
$pinfo.CreateNoWindow = $false

function Set-ProcessEnv($StartInfo, $Name, $Value) {
  if ($null -ne $StartInfo.EnvironmentVariables) {
    $StartInfo.EnvironmentVariables[$Name] = [string]$Value
    return
  }
  $StartInfo.Environment[$Name] = [string]$Value
}

Set-ProcessEnv $pinfo "SNIPER_ADMIN_API_ENABLED" "1"
Set-ProcessEnv $pinfo "SNIPER_ADMIN_API_HOST" "127.0.0.1"
Set-ProcessEnv $pinfo "SNIPER_ADMIN_API_PORT" "8791"
if ($token) { Set-ProcessEnv $pinfo "SNIPER_ADMIN_TOKEN" $token }
if ($envValues["SNIPER_ADMIN_EMAIL"]) { Set-ProcessEnv $pinfo "SNIPER_ADMIN_EMAIL" $envValues["SNIPER_ADMIN_EMAIL"] }
if ($envValues["SNIPER_ADMIN_PASSWORD"]) { Set-ProcessEnv $pinfo "SNIPER_ADMIN_PASSWORD" $envValues["SNIPER_ADMIN_PASSWORD"] }

[System.Diagnostics.Process]::Start($pinfo) | Out-Null

Write-Host "[3/3] Aguardando coletor na porta 8791..." -ForegroundColor Yellow
$ready = $false
for ($i = 1; $i -le 30; $i++) {
  Start-Sleep -Seconds 2
  try {
    $headers = @{ Accept = "application/json" }
    if ($token) { $headers.Authorization = "Bearer $token" }
    Invoke-RestMethod -Uri "http://127.0.0.1:8791/dashboard" -Headers $headers -TimeoutSec 3 | Out-Null
    $ready = $true
    break
  } catch { }
  Write-Host "  ... aguardando ($i/30)" -ForegroundColor Gray
}

Write-Host ""
if ($ready) {
  Write-Host "[OK] Coletor online! Chrome/mesa aberta." -ForegroundColor Green
  Write-Host "     NAO feche o Chrome." -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Agora rode LIGAR_SINAIS.bat ou REINICIAR_SINAIS.bat" -ForegroundColor Cyan
} else {
  Write-Host "[AVISO] Coletor ainda nao respondeu na porta 8791." -ForegroundColor Yellow
  Write-Host "  - Chrome abriu em 77super.com? Faca login se pedir." -ForegroundColor Yellow
  Write-Host "  - Clique Permitir se pedir 'gravando fluxo'." -ForegroundColor Yellow
  Write-Host "  - Veja erros em: $LogFile" -ForegroundColor Yellow
  if (Test-Path -LiteralPath $LogFile) {
    Write-Host ""
    Write-Host "Ultimas linhas do log:" -ForegroundColor Cyan
    Get-Content -LiteralPath $LogFile -Tail 8 | ForEach-Object { Write-Host "  $_" }
  }
}
Write-Host ""
