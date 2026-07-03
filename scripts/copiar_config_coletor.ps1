$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$Dest = Join-Path $ProjectRoot "config.json"

$candidates = @(
  (Join-Path $ProjectRoot "config.json"),
  (Join-Path $ProjectRoot "Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior\config.json"),
  "C:\Users\Usuario\OneDrive\Documentos\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior\config.json",
  "C:\Users\$env:USERNAME\OneDrive\Documentos\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior\config.json",
  "C:\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior\config.json"
) | Select-Object -Unique

if (Test-Path -LiteralPath $Dest) {
  Write-Host "config.json ja existe em $Dest" -ForegroundColor Green
  exit 0
}

foreach ($source in $candidates) {
  if (-not (Test-Path -LiteralPath $source)) { continue }
  if ((Resolve-Path -LiteralPath $source).Path -eq (Resolve-Path -LiteralPath $Dest -ErrorAction SilentlyContinue).Path) {
    Write-Host "config.json ja esta em $Dest" -ForegroundColor Green
    exit 0
  }
  Copy-Item -LiteralPath $source -Destination $Dest -Force
  Write-Host "Copiado: $source -> $Dest" -ForegroundColor Green
  exit 0
}

Write-Host "config.json nao encontrado no PC." -ForegroundColor Red
Write-Host "Procure manualmente e copie para: $Dest" -ForegroundColor Yellow
exit 1
