param(
  [string]$AdminEmail = "gabrielmendespromove@gmail.com",
  [string]$AdminPassword = "",
  [string]$LocalDashboardUrl = "http://127.0.0.1:8791/dashboard"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LocalEnv = Join-Path $ScriptDir "official_publisher.local.env"

if (-not $AdminPassword) {
  $AdminPassword = Read-Host "SNIPER_ADMIN_PASSWORD" -AsSecureString
  $AdminPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($AdminPassword)
  )
}

Write-Host "Validando login admin..." -ForegroundColor Cyan
$loginBody = @{ email = $AdminEmail; password = $AdminPassword } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "https://sniperbo.com/admin/login" -Method POST -ContentType "application/json" -Body $loginBody
if (-not $login.token) {
  throw "Login admin falhou."
}

$envContent = @"
SNIPER_ADMIN_EMAIL=$AdminEmail
SNIPER_ADMIN_PASSWORD=$AdminPassword
SNIPER_ADMIN_TOKEN=$($login.token)
SNIPER_LOCAL_DASHBOARD_TOKEN=$($login.token)
SNIPER_PUBLISHER_TOKEN=
SNIPER_REMOTE_DASHBOARD_TOKEN=
PUBLISHER_INTERVAL=0.25
FRONTEND_PORT=5175
SIGNALS_API_PORT=8787
SIGNALS_API_HOST=127.0.0.1
SNIPER_LOCAL_DASHBOARD_URL=$LocalDashboardUrl
SNIPER_REMOTE_PUBLISH_URL=https://sniperbo.com/dashboard/publish
"@

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($LocalEnv, $envContent, $utf8NoBom)
Write-Host "Credenciais salvas em $LocalEnv" -ForegroundColor Green
Write-Host "Token JWT obtido via login (nao use e-mail como token)." -ForegroundColor Yellow

Write-Host "Testando publish em sniperbo.com..." -ForegroundColor Cyan
try {
  $headers = @{
    Accept = "application/json"
    "User-Agent" = "Mozilla/5.0 SNIPERBO-Official-Publisher/1.0"
    "x-sniper-admin-email" = $AdminEmail
    "x-sniper-admin-password" = $AdminPassword
  }
  $probe = Invoke-RestMethod -Uri "https://sniperbo.com/dashboard/publish" -Method POST -Headers $headers -ContentType "application/json" -Body '{"probe":true}' -TimeoutSec 15
  if ($probe.ok) {
    Write-Host "Publish OK (probe)." -ForegroundColor Green
  } else {
    Write-Host "Publish respondeu mas ok!=true." -ForegroundColor Yellow
  }
} catch {
  Write-Host "ERRO publish probe: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "  Verifique SNIPER_ADMIN_PASSWORD e rode REINICIAR_SINAIS.bat de novo." -ForegroundColor Yellow
}
