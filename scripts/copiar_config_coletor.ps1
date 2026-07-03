$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$Dest = Join-Path $ProjectRoot "config.json"

& (Join-Path $ScriptDir "gerar_config_super.ps1")

if (-not (Test-Path -LiteralPath $Dest)) {
  Write-Host "Falha ao criar config.json da Casa Super." -ForegroundColor Red
  exit 1
}

Write-Host "Pronto. Agora rode ABRIR_MESA.bat" -ForegroundColor Cyan
