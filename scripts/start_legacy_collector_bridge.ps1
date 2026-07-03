param(
  [int]$LegacyApiPort = 8791,
  [int]$SignalsApiPort = 8787,
  [int]$StaleAfterSeconds = 300,
  [switch]$ForceRestart,
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

function Resolve-LegacyCollectorRoot($Root) {
  $candidates = @(
    $Root,
    "C:\SNIPERBO"
  ) | Select-Object -Unique

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath (Join-Path $candidate "sniper_bo_scraper.py")) {
      return $candidate
    }
  }
  return $Root
}

$LegacyRoot = Resolve-LegacyCollectorRoot $ProjectRoot
$LegacyScript = Join-Path $LegacyRoot "sniper_bo_scraper.py"
$LegacyEnvPath = Join-Path $LegacyRoot ".env"
if (-not (Test-Path -LiteralPath $LegacyEnvPath) -and (Test-Path -LiteralPath (Join-Path $ProjectRoot ".env"))) {
  $LegacyEnvPath = Join-Path $ProjectRoot ".env"
}
$LegacyPython = Join-Path $LegacyRoot ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $LegacyPython)) {
  $LegacyPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
}
$LegacyLog = Join-Path $ProjectRoot "official_legacy_collector.log"
$LegacyConfig = Join-Path $ProjectRoot "config.json"
if (-not (Test-Path -LiteralPath $LegacyConfig)) {
  $LegacyConfig = Join-Path $LegacyRoot "config.json"
}
$LegacyBrowserProfileMarker = "browser_profile_77super"
$StaleStatePath = Join-Path $LogDir "legacy_collector_watch_state.json"

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

function Get-LegacyChromeProcesses {
  @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -match "chrome" -and
      $_.CommandLine -like "*$LegacyBrowserProfileMarker*"
    })
}

function Stop-SafeProcess($ProcessId, $Reason) {
  if (-not $ProcessId -or $ProcessId -eq $PID) { return }
  try {
    Stop-Process -Id $ProcessId -Force -ErrorAction Stop
    Write-StartupLog "stopped pid=$ProcessId reason=$Reason"
  } catch {
    Write-StartupLog "failed to stop pid=$ProcessId reason=$Reason error=$($_.Exception.Message)"
  }
}

function Stop-LegacyCollectorStack($Reason) {
  $collectorProcesses = Get-CollectorProcesses
  foreach ($process in $collectorProcesses) {
    Stop-SafeProcess $process.ProcessId $Reason
  }

  $legacyListenerPid = Get-LegacyApiListenerPid
  if ($legacyListenerPid -and -not ($collectorProcesses.ProcessId -contains $legacyListenerPid)) {
    Stop-SafeProcess $legacyListenerPid "$Reason-listener"
  }

  foreach ($process in Get-LegacyChromeProcesses) {
    Stop-SafeProcess $process.ProcessId "$Reason-chrome"
  }

  if (Test-Path -LiteralPath $StaleStatePath) {
    Remove-Item -LiteralPath $StaleStatePath -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Seconds 2
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

function Test-FileFresh($Path, $MaxAgeSeconds) {
  try {
    if (-not (Test-Path -LiteralPath $Path)) { return $false }
    $age = (Get-Date) - (Get-Item -LiteralPath $Path).LastWriteTime
    return $age.TotalSeconds -le $MaxAgeSeconds
  } catch {
    Write-StartupLog "freshness check failed path=$Path error=$($_.Exception.Message)"
    return $false
  }
}

function Get-LegacyDashboardSnapshot($Token) {
  try {
    $headers = @{ Accept = "application/json" }
    if ($Token) { $headers.Authorization = "Bearer $Token" }
    $dashboard = Invoke-RestMethod -Uri "http://127.0.0.1:$LegacyApiPort/dashboard" -Headers $headers -TimeoutSec 3
    $latest = @($dashboard.rounds) | Select-Object -Last 1
    if (-not $latest) {
      return [pscustomobject]@{
        Ok = $true
        Signature = "empty-rounds"
        LatestId = ""
        Result = ""
        Banker = ""
        Player = ""
        RecordedAt = ""
      }
    }

    $latestId = [string]$latest.id
    $result = [string]$latest.resultado
    $banker = [string]$latest.BankerScore
    $player = [string]$latest.PlayerScore
    $recordedAt = [string]$latest.recordedAt
    $signature = "$latestId|$result|$banker|$player|$recordedAt"
    return [pscustomobject]@{
      Ok = $true
      Signature = $signature
      LatestId = $latestId
      Result = $result
      Banker = $banker
      Player = $player
      RecordedAt = $recordedAt
    }
  } catch {
    Write-StartupLog "legacy dashboard snapshot failed: $($_.Exception.Message)"
    return $null
  }
}

function Read-StaleState {
  if (-not (Test-Path -LiteralPath $StaleStatePath)) { return $null }
  try {
    return Get-Content -LiteralPath $StaleStatePath -Raw | ConvertFrom-Json
  } catch {
    Write-StartupLog "legacy stale state unreadable: $($_.Exception.Message)"
    return $null
  }
}

function Write-StaleState($Signature, $ChangedAt, $Failures = 0) {
  $state = [pscustomobject]@{
    signature = [string]$Signature
    changedAt = $ChangedAt.ToString("o")
    failures = [int]$Failures
    checkedAt = (Get-Date).ToString("o")
  }
  $state | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $StaleStatePath -Encoding UTF8
}

function Test-LegacyCollectorFresh($Token) {
  if ($ForceRestart) {
    return [pscustomobject]@{ ShouldRestart = $true; Reason = "manual-force-restart" }
  }

  $now = Get-Date
  $snapshot = Get-LegacyDashboardSnapshot $Token
  $state = Read-StaleState

  if (-not $snapshot) {
    $failures = 1
    if ($state -and $state.failures) { $failures = [int]$state.failures + 1 }
    Write-StaleState "dashboard-failure" $now $failures
    Write-StartupLog "legacy collector dashboard unavailable failures=$failures keeping collector/browser alive"
    return [pscustomobject]@{ ShouldRestart = $false; Reason = "legacy-dashboard-failure-$failures" }
  }

  if (-not $state -or [string]$state.signature -ne [string]$snapshot.Signature) {
    Write-StaleState $snapshot.Signature $now 0
    Write-StartupLog "legacy collector moving latest=$($snapshot.LatestId) result=$($snapshot.Result) score=$($snapshot.Banker)-$($snapshot.Player)"
    return [pscustomobject]@{ ShouldRestart = $false; Reason = "moving" }
  }

  $changedAt = $now
  try {
    $changedAt = [DateTime]::Parse([string]$state.changedAt)
  } catch {
    $changedAt = $now
  }

  $staleSeconds = [int]([Math]::Max(0, ($now - $changedAt).TotalSeconds))
  Write-StaleState $snapshot.Signature $changedAt 0
  Write-StartupLog "legacy collector unchanged latest=$($snapshot.LatestId) score=$($snapshot.Banker)-$($snapshot.Player) staleSeconds=$staleSeconds"

  if ($staleSeconds -ge $StaleAfterSeconds) {
    return [pscustomobject]@{ ShouldRestart = $true; Reason = "legacy-round-stale-$staleSeconds-seconds" }
  }

  return [pscustomobject]@{ ShouldRestart = $false; Reason = "fresh-enough" }
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

$freshness = Test-LegacyCollectorFresh $legacyToken
if ($freshness.ShouldRestart) {
  Write-StartupLog "restarting legacy collector reason=$($freshness.Reason)"
  Stop-LegacyCollectorStack $freshness.Reason
}

$collectorProcesses = Get-CollectorProcesses
$legacyListenerPid = Get-LegacyApiListenerPid
if ($collectorProcesses.Count -gt 1 -and $legacyListenerPid) {
  $collectorPidText = ($collectorProcesses.ProcessId -join ",")
  Write-StartupLog "legacy collector duplicate detected listener=$legacyListenerPid pids=$collectorPidText keeping all alive to avoid closing browser"
}
$legacyDashboardReady = Test-Url "http://127.0.0.1:$LegacyApiPort/dashboard" $legacyToken
if ($collectorProcesses.Count -eq 0 -and -not $legacyListenerPid -and -not $legacyDashboardReady) {
  Write-StartupLog "starting legacy collector isolated port=$LegacyApiPort root=$LegacyRoot"
  $configArgs = ""
  if (Test-Path -LiteralPath $LegacyConfig) {
    $configArgs = "--config `"$LegacyConfig`""
    Write-StartupLog "collector config=$LegacyConfig"
  } else {
    Write-StartupLog "collector config missing path=$LegacyConfig starting without --config"
  }
  $collectorInfo = New-Object System.Diagnostics.ProcessStartInfo
  $collectorInfo.FileName = $LegacyPython
  $collectorInfo.Arguments = "`"$LegacyScript`" $configArgs --interval 0.5 --admin-api-enabled --no-telegram --log-file `"$LegacyLog`""
  $collectorInfo.WorkingDirectory = $ProjectRoot
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
  Write-StartupLog "legacy collector present count=$($collectorProcesses.Count) listener=$legacyListenerPid dashboard=$legacyDashboardReady pids=$collectorPidText keeping collector/browser alive"
}

if (-not (Test-Url "http://127.0.0.1:$LegacyApiPort/dashboard" $legacyToken)) {
  Write-StartupLog "legacy collector dashboard not ready port=$LegacyApiPort"
} else {
  Write-StartupLog "legacy collector dashboard ok port=$LegacyApiPort"
}

$bridgeProcesses = Get-BridgeProcesses
$bridgeLogFresh = Test-FileFresh $BridgeLog 10
if ($bridgeProcesses.Count -eq 0 -and -not $bridgeLogFresh) {
  Write-StartupLog "starting collector bridge $LegacyApiPort -> $SignalsApiPort"
  $bridgeInfo = New-Object System.Diagnostics.ProcessStartInfo
  $bridgeInfo.FileName = "python.exe"
  $bridgeInfo.Arguments = "scripts\official_dashboard_publisher.py --env-file `"$LocalEnvPath`" --local-url `"http://127.0.0.1:$LegacyApiPort/dashboard`" --remote-base-url `"http://127.0.0.1:$SignalsApiPort`" --remote-url `"http://127.0.0.1:$SignalsApiPort/dashboard`" --interval 0.35 --repeat-interval 1.0 --remote-timeout 1.5 --urgent-retry-interval 0.35 --non-entry-urgent-interval 1.0 --urgent-signal --log-file legacy_collector_bridge.log"
  $bridgeInfo.WorkingDirectory = $ProjectRoot
  $bridgeInfo.UseShellExecute = $false
  $bridgeInfo.CreateNoWindow = $true
  Set-ProcessEnv $bridgeInfo "SNIPER_LOCAL_DASHBOARD_TOKEN" $legacyToken
  Set-ProcessEnv $bridgeInfo "SNIPER_REMOTE_DASHBOARD_TOKEN" $officialToken
  if ($adminEmail) { Set-ProcessEnv $bridgeInfo "SNIPER_ADMIN_EMAIL" $adminEmail }
  if ($adminPassword) { Set-ProcessEnv $bridgeInfo "SNIPER_ADMIN_PASSWORD" $adminPassword }
  Set-ProcessEnv $bridgeInfo "SNIPER_ADMIN_TOKEN" $officialToken
  [System.Diagnostics.Process]::Start($bridgeInfo) | Out-Null
} elseif ($bridgeProcesses.Count -eq 0 -and $bridgeLogFresh) {
  Write-StartupLog "collector bridge log fresh; not starting duplicate"
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
