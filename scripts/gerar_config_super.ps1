$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$Corrigir = Join-Path $ScriptDir "corrigir_para_super.ps1"

Write-Host "[AVISO] gerar_config_super.ps1 esta obsoleto — usando corrigir_para_super.ps1" -ForegroundColor Yellow
if (Test-Path -LiteralPath $Corrigir) {
  & $Corrigir -SkipOpenMesa -SkipKill
  exit $LASTEXITCODE
}

throw "Script corrigir_para_super.ps1 nao encontrado em $ScriptDir"
