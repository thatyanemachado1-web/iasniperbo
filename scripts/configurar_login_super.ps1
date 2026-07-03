param(
  [string]$SuperEmail = "",
  [string]$SuperPassword = "",
  [string]$SuperUsername = "",
  [string]$SuperCpf = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$LocalEnv = Join-Path $ScriptDir "super_casino.local.env"
$Example = Join-Path $ScriptDir "super_casino.local.env.example"

if (-not (Test-Path -LiteralPath $LocalEnv)) {
  if (Test-Path -LiteralPath $Example) {
    Copy-Item -LiteralPath $Example -Destination $LocalEnv
  } else {
    @"
SUPER_LOGIN_EMAIL=
SUPER_LOGIN_PASSWORD=
SUPER_LOGIN_USERNAME=
SUPER_LOGIN_CPF=
"@ | Set-Content -LiteralPath $LocalEnv -Encoding UTF8
  }
}

$values = @{}
Get-Content -LiteralPath $LocalEnv | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) { return }
  $p = $line.Split("=", 2)
  $values[$p[0].Trim()] = $p[1].Trim()
}

if (-not $SuperEmail) { $SuperEmail = $values["SUPER_LOGIN_EMAIL"] }
if (-not $SuperPassword) { $SuperPassword = $values["SUPER_LOGIN_PASSWORD"] }
if (-not $SuperUsername) { $SuperUsername = $values["SUPER_LOGIN_USERNAME"] }
if (-not $SuperCpf) { $SuperCpf = $values["SUPER_LOGIN_CPF"] }

if (-not $SuperEmail -or -not $SuperPassword) {
  Write-Host ""
  Write-Host "=== Login automatico Casa Super ===" -ForegroundColor Cyan
  if (-not $SuperEmail) { $SuperEmail = Read-Host "Email da Super (77super.com)" }
  if (-not $SuperPassword) {
    $secure = Read-Host "Senha da Super" -AsSecureString
    $SuperPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
      [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    )
  }
}

if (-not $SuperEmail -or -not $SuperPassword) {
  throw "Email e senha da Super sao obrigatorios."
}

$envContent = @"
SUPER_LOGIN_EMAIL=$SuperEmail
SUPER_LOGIN_PASSWORD=$SuperPassword
SUPER_LOGIN_USERNAME=$SuperUsername
SUPER_LOGIN_CPF=$SuperCpf
"@
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($LocalEnv, $envContent, $utf8NoBom)
Write-Host "Credenciais Super salvas em $LocalEnv" -ForegroundColor Green

$python = "python.exe"
$candidates = @(
  (Join-Path $ProjectRoot "Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior\.venv\Scripts\python.exe"),
  (Join-Path $ProjectRoot ".venv\Scripts\python.exe")
)
foreach ($c in $candidates) { if (Test-Path -LiteralPath $c) { $python = $c; break } }

& $python (Join-Path $ScriptDir "aplicar_login_super.py") $ProjectRoot
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Login automatico ativado no config.json" -ForegroundColor Green
