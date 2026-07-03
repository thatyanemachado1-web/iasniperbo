param(
  [string]$AdminEmail = "gabrielmendespromove@gmail.com",
  [string]$AdminPassword = "AdminSniper2026!",
  [string]$LocalDashboardUrl = "http://127.0.0.1:8791/dashboard"
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $ScriptDir "configurar_publisher_credenciais.ps1") `
  -AdminEmail $AdminEmail `
  -AdminPassword $AdminPassword `
  -LocalDashboardUrl $LocalDashboardUrl
& (Join-Path $ScriptDir "start_official_publisher.ps1")
