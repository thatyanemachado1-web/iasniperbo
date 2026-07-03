$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$LocalEnv = Join-Path $Root "scripts\official_publisher.local.env"
$Scraper = Join-Path $Root "sniper_bo_scraper.py"
$Config = Join-Path $Root "config.json"
$Log = Join-Path $Root "official_legacy_collector.log"

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

if (-not (Test-Path -LiteralPath $Scraper)) {
  Write-Host "ERRO: sniper_bo_scraper.py nao encontrado em $Root" -ForegroundColor Red
  exit 1
}

$envValues = Read-EnvFile $LocalEnv
$token = $envValues["SNIPER_ADMIN_TOKEN"]
$email = $envValues["SNIPER_ADMIN_EMAIL"]
$password = $envValues["SNIPER_ADMIN_PASSWORD"]

$pythonCandidates = @(
  "C:\Users\Usuario\OneDrive\Documentos\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior\.venv\Scripts\python.exe",
  "C:\Users\$env:USERNAME\OneDrive\Documentos\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior\.venv\Scripts\python.exe",
  (Join-Path $Root ".venv\Scripts\python.exe"),
  "python.exe"
) | Select-Object -Unique

$pythonExe = $pythonCandidates | Where-Object { Test-Path -LiteralPath $_ -or $_ -eq "python.exe" } | Select-Object -First 1
if (-not $pythonExe) { $pythonExe = "python.exe" }

$configArg = ""
if (Test-Path -LiteralPath $Config) {
  $configArg = "--config `"$Config`""
}

$args = "`"$Scraper`" $configArg --interval 0.5 --admin-api-enabled --no-telegram --log-file `"$Log`""

Write-Host "Python: $pythonExe" -ForegroundColor Cyan
Write-Host "Abrindo coletor + Chrome..." -ForegroundColor Green
Write-Host "NAO FECHE esta janela." -ForegroundColor Yellow
Write-Host ""

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $pythonExe
$psi.Arguments = $args
$psi.WorkingDirectory = $Root
$psi.UseShellExecute = $false
$psi.Environment["SNIPER_ADMIN_API_ENABLED"] = "1"
$psi.Environment["SNIPER_ADMIN_API_HOST"] = "127.0.0.1"
$psi.Environment["SNIPER_ADMIN_API_PORT"] = "8791"
if ($token) { $psi.Environment["SNIPER_ADMIN_TOKEN"] = $token }
if ($email) { $psi.Environment["SNIPER_ADMIN_EMAIL"] = $email }
if ($password) { $psi.Environment["SNIPER_ADMIN_PASSWORD"] = $password }

$p = [System.Diagnostics.Process]::Start($psi)
$p.WaitForExit()
Write-Host ""
Write-Host "Coletor encerrou. Codigo: $($p.ExitCode)" -ForegroundColor $(if ($p.ExitCode -eq 0) { "Green" } else { "Red" })
