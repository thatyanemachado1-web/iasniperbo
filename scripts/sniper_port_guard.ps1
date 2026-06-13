param(
  [int]$FrontendPort = $(if ($env:FRONTEND_PORT) { [int]$env:FRONTEND_PORT } else { 5175 }),
  [int]$SignalsApiPort = $(if ($env:SIGNALS_API_PORT) { [int]$env:SIGNALS_API_PORT } else { 8787 }),
  [switch]$NoKill
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$LogDir = Join-Path $ProjectRoot "logs"
$LogPath = Join-Path $LogDir "port_guard.log"
$LockPath = Join-Path $LogDir "signals-api.pid.lock"
$OldMarkers = @(
  "start_sniperbo_auto.ps1",
  "sniper_bo_scraper.py",
  "dashboard_remote_publisher.py",
  "__disable_validator_history__.sqlite3",
  "local-codex-test-token"
)

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

function Write-GuardLog($Message) {
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -LiteralPath $LogPath -Value "$timestamp $Message"
}

function Get-ProcessCommandLine($ProcessId) {
  try {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction SilentlyContinue
    if (-not $process) { return "" }
    return [string]$process.CommandLine
  } catch {
    Write-GuardLog "command line unavailable pid=$ProcessId error=$($_.Exception.Message)"
    return ""
  }
}

function Get-ProcessPathSafe($Process) {
  try {
    return [string]$Process.Path
  } catch {
    Write-GuardLog "process path unavailable pid=$($Process.Id) error=$($_.Exception.Message)"
    return ""
  }
}

function Get-AllProcessesSafe {
  try {
    return @(Get-CimInstance Win32_Process -Property ProcessId,Name,ExecutablePath,CommandLine -ErrorAction Stop |
      ForEach-Object {
        [pscustomobject]@{
          ProcessId = $_.ProcessId
          Name = $_.Name
          Path = [string]$_.ExecutablePath
          CommandLine = [string]$_.CommandLine
          IsCommandLineReadable = [bool]$_.CommandLine
        }
      })
  } catch {
    Write-GuardLog "full process audit denied; using limited fallback: $($_.Exception.Message)"
  }

  $candidateNames = @("python", "python3", "powershell", "pwsh", "node", "chrome", "cmd")
  @(Get-Process -ErrorAction SilentlyContinue |
    Where-Object { $candidateNames -contains $_.ProcessName.ToLowerInvariant() } |
    ForEach-Object {
      $commandLine = Get-ProcessCommandLine $_.Id
      [pscustomobject]@{
        ProcessId = $_.Id
        Name = $_.ProcessName
        Path = Get-ProcessPathSafe $_
        CommandLine = $commandLine
        IsCommandLineReadable = [bool]$commandLine
      }
    })
}

function Test-OldSniperProcess($CommandLine) {
  if (Test-AllowedLegacyCollectorProcess $CommandLine) {
    return $false
  }
  foreach ($marker in $OldMarkers) {
    if ($CommandLine -like "*$marker*") { return $true }
  }
  return $false
}

function Test-AllowedLegacyCollectorProcess($CommandLine) {
  if (-not $CommandLine) { return $false }
  return (
    $CommandLine -like "*sniper_bo_scraper.py*" -and
    $CommandLine -like "*official_legacy_collector.log*" -and
    $CommandLine -notlike "*SNIPER_ADMIN_API_PORT=8787*"
  )
}

function Get-PortListeners($Port) {
  @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    $process = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
    $commandLine = Get-ProcessCommandLine $_.OwningProcess
    [pscustomobject]@{
      LocalAddress = $_.LocalAddress
      LocalPort = $_.LocalPort
      PID = $_.OwningProcess
      Process = $process.ProcessName
      Path = if ($process) { Get-ProcessPathSafe $process } else { "" }
      CommandLine = $commandLine
      IsOldSniper = Test-OldSniperProcess $commandLine
    }
  })
}

function Test-SignalsApiHealth($Port) {
  try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 3
    return $response.status -eq "online" -and $response.service -eq "signals-api"
  } catch {
    return $false
  }
}

function Stop-InvalidProcess($ProcessId, $Reason) {
  if ($NoKill) {
    Write-GuardLog "would stop pid=$ProcessId reason=$Reason"
    return
  }

  Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
  Write-GuardLog "stopped pid=$ProcessId reason=$Reason"
}

$oldProcesses = @()
$allProcesses = Get-AllProcessesSafe
$unreadableProcesses = @($allProcesses | Where-Object { -not $_.IsCommandLineReadable })
$oldProcesses = @($allProcesses | Where-Object { Test-OldSniperProcess $_.CommandLine })
if ($unreadableProcesses.Count -gt 0) {
  Write-GuardLog "processes skipped without command line permission count=$($unreadableProcesses.Count)"
}

foreach ($process in $oldProcesses) {
  if ($process.ProcessId -ne $PID) {
    Stop-InvalidProcess $process.ProcessId "old-sniper-package"
  }
}

$frontendListeners = Get-PortListeners $FrontendPort
$signalsListeners = Get-PortListeners $SignalsApiPort
$signalsHealthOk = Test-SignalsApiHealth $SignalsApiPort

foreach ($listener in $signalsListeners) {
  if ($listener.IsOldSniper) {
    Stop-InvalidProcess $listener.PID "old-process-on-signals-port-$SignalsApiPort"
    continue
  }

  if (-not $signalsHealthOk) {
    Stop-InvalidProcess $listener.PID "invalid-signals-api-health-on-port-$SignalsApiPort"
  }
}

$finalSignalsListeners = Get-PortListeners $SignalsApiPort
$finalHealthOk = Test-SignalsApiHealth $SignalsApiPort
if ($finalHealthOk -and $finalSignalsListeners.Count -eq 1) {
  Set-Content -LiteralPath $LockPath -Value ([string]$finalSignalsListeners[0].PID)
}

$report = [pscustomobject]@{
  checkedAt = (Get-Date).ToString("o")
  frontendPort = $FrontendPort
  signalsApiPort = $SignalsApiPort
  oldProcessesFound = $oldProcesses.Count
  frontendListeners = $frontendListeners | Select-Object LocalAddress,LocalPort,PID,Process,Path,IsOldSniper
  signalsListenersBefore = $signalsListeners | Select-Object LocalAddress,LocalPort,PID,Process,Path,IsOldSniper
  signalsListenersAfter = $finalSignalsListeners | Select-Object LocalAddress,LocalPort,PID,Process,Path,IsOldSniper
  signalsHealthOk = $finalHealthOk
  logPath = $LogPath
  lockPath = $LockPath
}

Write-GuardLog "audit frontend=$FrontendPort signals=$SignalsApiPort old=$($oldProcesses.Count) health=$finalHealthOk"
$report | ConvertTo-Json -Depth 5
