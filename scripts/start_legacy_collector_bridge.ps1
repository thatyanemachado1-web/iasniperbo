param(
  [int]$LegacyApiPort = 8791,
  [int]$SignalsApiPort = 8787,
  [switch]$Quiet
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$LogDir = Join-Path $ProjectRoot "logs"
$StartupLog = Join-Path $LogDir "legacy_collector_startup.log"
$BridgeLog = Join-Path $ProjectRoot "legacy_collector_bridge.log"
$PublisherScript = Join-Path $ScriptDir "official_dashboard_publisher.py"
$LocalEnvPath = Join-Path $ScriptDir "official_publisher.local.env"
$ProjectEnvPath = Join-Path $ProjectRoot ".env"
$LegacyRoot = "C:\Users\Usuario\OneDrive\Documentos\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior"
$LegacyScript = Join-Path $LegacyRoot "sniper_bo_scraper.py"
$LegacyEnvPath = Join-Path $LegacyRoot ".env"
$LegacyPython = Join-Path $LegacyRoot ".venv\Scripts\python.exe"
$LegacyLog = Join-Path $LegacyRoot "official_legacy_collector.log"

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

function Write-StartupLog($Message) {
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -LiteralPath $StartupLog -Value "$timestamp $Message"
}

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

function Read-EnvValue($Values, $Name, $Default = "") {
  $processValue = [Environment]::GetEnvironmentVariable($Name, "Process")
  if ($processValue) { return $processValue }
  if ($Values.ContainsKey($Name)) { return [string]$Values[$Name] }
  return $Default
}

function Get-CollectorProcesses {
  @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -match "python" -and
      $_.CommandLine -like "*sniper_bo_scraper.py*" -and
      $_.CommandLine -like "*official_legacy_collector.log*"
    })
}

function Get-LegacyApiListenerPid {
  try {
    $listener = Get-NetTCPConnection -LocalPort $LegacyApiPort -State Listen -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($listener) { return [int]$listener.OwningProcess }
  } catch {
    Write-StartupLog "legacy listener check failed: $($_.Exception.Message)"
  }
  return 0
}

function Get-BridgeProcesses {
  @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -match "python" -and
      $_.CommandLine -like "*official_dashboard_publisher.py*" -and
      $_.CommandLine -like "*legacy_collector_bridge.log*"
    })
}

function Test-Url($Url, $Token = "") {
  try {
    $headers = @{ Accept = "application/json" }
    if ($Token) { $headers.Authorization = "Bearer $Token" }
    $response = Invoke-WebRequest -Uri $Url -Headers $headers -TimeoutSec 3 -UseBasicParsing
    return [int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Set-ProcessEnv($StartInfo, $Name, $Value) {
  if ($null -ne $StartInfo.EnvironmentVariables) {
    $StartInfo.EnvironmentVariables[$Name] = [string]$Value
    return
  }
  $StartInfo.Environment[$Name] = [string]$Value
}

if (-not (Test-Path -LiteralPath $LegacyScript)) {
  Write-StartupLog "legacy scraper not found path=$LegacyScript"
  throw "Legacy collector script not found."
}
if (-not (Test-Path -LiteralPath $PublisherScript)) {
  Write-StartupLog "publisher script not found path=$PublisherScript"
  throw "Publisher script not found."
}
if (-not (Test-Path -LiteralPath $LegacyPython)) {
  $LegacyPython = "python.exe"
}

$legacyEnv = Read-EnvFile $LegacyEnvPath
$projectEnv = Read-EnvFile $ProjectEnvPath
$localEnv = Read-EnvFile $LocalEnvPath

$adminEmail = Read-EnvValue $projectEnv "SNIPER_ADMIN_EMAILS"
if ($adminEmail -and $adminEmail.Contains(",")) { $adminEmail = $adminEmail.Split(",", 2)[0].Trim() }
if (-not $adminEmail) { $adminEmail = Read-EnvValue $localEnv "SNIPER_ADMIN_EMAIL" }
if (-not $adminEmail) { $adminEmail = Read-EnvValue $legacyEnv "SNIPER_ADMIN_EMAIL" }

$adminPassword = Read-EnvValue $localEnv "SNIPER_ADMIN_PASSWORD"
if (-not $adminPassword) { $adminPassword = Read-EnvValue $legacyEnv "SNIPER_ADMIN_PASSWORD" }

$legacyToken = Read-EnvValue $legacyEnv "SNIPER_ADMIN_TOKEN"
if (-not $legacyToken) { $legacyToken = Read-EnvValue $localEnv "SNIPER_ADMIN_TOKEN" }

$officialToken = Read-EnvValue $projectEnv "SNIPER_DASHBOARD_TOKEN"
if (-not $officialToken) { $officialToken = Read-EnvValue $projectEnv "VITE_SNIPER_DASHBOARD_TOKEN" }
if (-not $officialToken) { $officialToken = Read-EnvValue $localEnv "SNIPER_ADMIN_TOKEN" }

if (-not $legacyToken -or -not $officialToken) {
  Write-StartupLog "missing collector bridge token configuration"
  throw "Legacy collector bridge tokens are missing."
}

$collectorProcesses = Get-CollectorProcesses
$legacyListenerPid = Get-LegacyApiListenerPid
if ($collectorProcesses.Count -eq 0 -and -not $legacyListenerPid) {
  Write-StartupLog "starting legacy collector isolated port=$LegacyApiPort"
  $collectorInfo = New-Object System.Diagnostics.ProcessStartInfo
  $collectorInfo.FileName = $LegacyPython
  $collectorInfo.Arguments = "`"$LegacyScript`" --config `"config.json`" --interval 0.5 --admin-api-enabled --no-telegram --log-file `"official_legacy_collector.log`""
  $collectorInfo.WorkingDirectory = $LegacyRoot
  $collectorInfo.UseShellExecute = $false
  $collectorInfo.CreateNoWindow = $true
  Set-ProcessEnv $collectorInfo "SNIPER_ADMIN_API_ENABLED" "1"
  Set-ProcessEnv $collectorInfo "SNIPER_ADMIN_API_HOST" "127.0.0.1"
  Set-ProcessEnv $collectorInfo "SNIPER_ADMIN_API_PORT" $LegacyApiPort
  Set-ProcessEnv $collectorInfo "SNIPER_ADMIN_TOKEN" $legacyToken
  if ($adminEmail) { Set-ProcessEnv $collectorInfo "SNIPER_ADMIN_EMAIL" $adminEmail }
  if ($adminPassword) { Set-ProcessEnv $collectorInfo "SNIPER_ADMIN_PASSWORD" $adminPassword }
  [System.Diagnostics.Process]::Start($collectorInfo) | Out-Null
  Start-Sleep -Seconds 4
} else {
  $collectorPidText = ($collectorProcesses.ProcessId -join ",")
  Write-StartupLog "legacy collector present count=$($collectorProcesses.Count) listener=$legacyListenerPid pids=$collectorPidText keeping collector/browser alive"
}

if (-not (Test-Url "http://127.0.0.1:$LegacyApiPort/dashboard" $legacyToken)) {
  Write-StartupLog "legacy collector dashboard not ready port=$LegacyApiPort"
} else {
  Write-StartupLog "legacy collector dashboard ok port=$LegacyApiPort"
}

$bridgeProcesses = Get-BridgeProcesses
if ($bridgeProcesses.Count -eq 0) {
  Write-StartupLog "starting collector bridge $LegacyApiPort -> $SignalsApiPort"
  $bridgeInfo = New-Object System.Diagnostics.ProcessStartInfo
  $bridgeInfo.FileName = "python.exe"
  $bridgeInfo.Arguments = "scripts\official_dashboard_publisher.py --env-file `"$LocalEnvPath`" --local-url `"http://127.0.0.1:$LegacyApiPort/dashboard`" --remote-base-url `"http://127.0.0.1:$SignalsApiPort`" --remote-url `"http://127.0.0.1:$SignalsApiPort/dashboard`" --interval 0.7 --log-file legacy_collector_bridge.log"
  $bridgeInfo.WorkingDirectory = $ProjectRoot
  $bridgeInfo.UseShellExecute = $false
  $bridgeInfo.CreateNoWindow = $true
  Set-ProcessEnv $bridgeInfo "SNIPER_LOCAL_DASHBOARD_TOKEN" $legacyToken
  Set-ProcessEnv $bridgeInfo "SNIPER_REMOTE_DASHBOARD_TOKEN" $officialToken
  if ($adminEmail) { Set-ProcessEnv $bridgeInfo "SNIPER_ADMIN_EMAIL" $adminEmail }
  if ($adminPassword) { Set-ProcessEnv $bridgeInfo "SNIPER_ADMIN_PASSWORD" $adminPassword }
  Set-ProcessEnv $bridgeInfo "SNIPER_ADMIN_TOKEN" $officialToken
  [System.Diagnostics.Process]::Start($bridgeInfo) | Out-Null
} elseif ($bridgeProcesses.Count -gt 1) {
  $bridgeProcesses | Sort-Object ProcessId | Select-Object -Skip 1 | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    Write-StartupLog "stopped duplicate collector bridge pid=$($_.ProcessId)"
  }
}

if (-not $Quiet) {
  Start-Sleep -Seconds 2
  Write-Output "legacy collector: $((Get-CollectorProcesses).ProcessId -join ', ')"
  Write-Output "collector bridge: $((Get-BridgeProcesses).ProcessId -join ', ')"
  Write-Output "logs: $StartupLog ; $BridgeLog ; $LegacyLog"
}
