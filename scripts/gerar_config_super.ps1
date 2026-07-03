$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$Dest = Join-Path $ProjectRoot "config.json"
$Example = Join-Path $ProjectRoot "config.super.json.example"
$GameUrl = "https://77super.com/en/game/101803005-Bac%20Bo"

$config = @{
  casa = "super"
  url = $GameUrl
  game_url = $GameUrl
  target_url = $GameUrl
  mesa_url = $GameUrl
  login_url = "https://77super.com/"
  browser_profile_dir = "browser_profile_77super"
  profile_directory = "browser_profile_77super"
  user_data_dir = "browser_profile_77super"
  headless = $false
  no_telegram = $true
}

if (Test-Path -LiteralPath $Example) {
  Copy-Item -LiteralPath $Example -Destination $Dest -Force
} else {
  $json = $config | ConvertTo-Json -Depth 4
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($Dest, $json, $utf8NoBom)
}

Write-Host "[OK] config.json Casa Super (77super.com)" -ForegroundColor Green
Write-Host "     $Dest" -ForegroundColor Gray
Write-Host "     Mesa: $GameUrl" -ForegroundColor Gray
