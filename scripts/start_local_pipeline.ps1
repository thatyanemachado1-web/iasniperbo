param(
  [int]$FrontendPort = 5175,
  [int]$SignalsApiPort = 8787,
  [int]$LegacyApiPort = 8791,
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$LogDir = Join-Path $ProjectRoot "logs"
$LocalLog = Join-Path $LogDir "local_pipeline.log"
$StartSignalsScript = Join-Path $ScriptDir "start_official_signals_api.ps1"
$StartBridgeScript = Join-Path $ScriptDir "start_legacy_collector_bridge.ps1"

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

function Write-LocalLog($Message) {
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -LiteralPath $LocalLog -Value "$timestamp $Message"
  Write-Output "$timestamp $Message"
}

function Get-ProcessCommandLine($ProcessId) {
  try {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction SilentlyContinue
    if ($process) { return [string]$process.CommandLine }
  } catch {}
  return ""
}

function Stop-ProcessSafe($ProcessId, $Reason) {
  if (-not $ProcessId -or $ProcessId -eq $PID) { return }
  try {
    Stop-Process -Id $ProcessId -Force -ErrorAction Stop
    Write-LocalLog "stopped pid=$ProcessId reason=$Reason"
  } catch {
    Write-LocalLog "failed to stop pid=$ProcessId reason=$Reason error=$($_.Exception.Message)"
  }
}

function Stop-PortListeners($Port, $Reason) {
  $listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
  foreach ($listener in $listeners) {
    Stop-ProcessSafe $listener.OwningProcess "$Reason-port-$Port"
  }
}

function Stop-ConflictingPublishers {
  $processes = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -match "python" -and
      $_.CommandLine -like "*official_dashboard_publisher.py*" -and
      $_.CommandLine -notlike "*legacy_collector_bridge.log*"
    })
  foreach ($process in $processes) {
    Stop-ProcessSafe $process.ProcessId "disable-non-local-publisher"
  }
}

function Test-Url($Url) {
  try {
    $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 4 -UseBasicParsing
    return [int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Test-SignalsHealth {
  try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:$SignalsApiPort/health" -TimeoutSec 4
    return $response.status -eq "online" -and $response.service -eq "signals-api" -and [int]$response.port -eq $SignalsApiPort
  } catch {
    return $false
  }
}

function Start-Frontend {
  if (Test-Url "http://127.0.0.1:$FrontendPort/") {
    $listener = Get-NetTCPConnection -LocalPort $FrontendPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    $commandLine = if ($listener) { Get-ProcessCommandLine $listener.OwningProcess } else { "" }
    if ($commandLine -like "*$ProjectRoot*") {
      Write-LocalLog "frontend already healthy port=$FrontendPort"
      return
    }
  }

  Stop-PortListeners $FrontendPort "frontend-conflict"
  $npm = "C:\Program Files\nodejs\npm.cmd"
  $processInfo = New-Object System.Diagnostics.ProcessStartInfo
  $processInfo.FileName = "$env:SystemRoot\System32\cmd.exe"
  $processInfo.Arguments = "/d /s /c `"`"$npm`" run dev -- --host 127.0.0.1 --port $FrontendPort --strictPort`""
  $processInfo.WorkingDirectory = $ProjectRoot
  $processInfo.UseShellExecute = $false
  $processInfo.CreateNoWindow = $true
  $processInfo.EnvironmentVariables["FRONTEND_PORT"] = [string]$FrontendPort
  $processInfo.EnvironmentVariables["SIGNALS_API_PORT"] = [string]$SignalsApiPort
  $processInfo.EnvironmentVariables["SNIPER_LOCAL_MODE"] = "1"
  $processInfo.EnvironmentVariables["VITE_SNIPER_DASHBOARD_URL"] = "http://127.0.0.1:$SignalsApiPort/dashboard"
  [System.Diagnostics.Process]::Start($processInfo) | Out-Null
  Write-LocalLog "frontend starting port=$FrontendPort"
}

function Wait-Until($Label, [scriptblock]$Check, [int]$Attempts = 20, [int]$DelaySeconds = 1) {
  for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    if (& $Check) {
      Write-LocalLog "$Label ok attempt=$attempt"
      return $true
    }
    Start-Sleep -Seconds $DelaySeconds
  }
  Write-LocalLog "$Label failed"
  return $false
}

Write-LocalLog "local pipeline starting root=$ProjectRoot frontend=$FrontendPort signals=$SignalsApiPort legacy=$LegacyApiPort"
Stop-ConflictingPublishers

if (-not $SkipBuild) {
  $serverEntry = Join-Path $ProjectRoot "dist\server\server.js"
  if (-not (Test-Path -LiteralPath $serverEntry)) {
    Write-LocalLog "dist missing; running npm build"
    & "C:\Program Files\nodejs\npm.cmd" run build
  }
}

& $StartSignalsScript -SignalsApiPort $SignalsApiPort -FrontendPort $FrontendPort
Start-Frontend
& $StartBridgeScript -LegacyApiPort $LegacyApiPort -SignalsApiPort $SignalsApiPort -Quiet

$signalsOk = Wait-Until "signals-api" { Test-SignalsHealth } 20 1
$frontendOk = Wait-Until "frontend" { Test-Url "http://127.0.0.1:$FrontendPort/" } 20 1
$legacyOk = Wait-Until "legacy-collector-dashboard" { Test-Url "http://127.0.0.1:$LegacyApiPort/dashboard" } 20 1

$bridgeProcesses = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object {
    $_.Name -match "python" -and
    $_.CommandLine -like "*official_dashboard_publisher.py*" -and
    $_.CommandLine -like "*legacy_collector_bridge.log*" -and
    $_.CommandLine -like "*http://127.0.0.1:$SignalsApiPort/dashboard*"
  })

Write-LocalLog "local pipeline status signals=$signalsOk frontend=$frontendOk legacy=$legacyOk bridgePids=$($bridgeProcesses.ProcessId -join ',')"
Write-Output "LOCAL_DASHBOARD=http://127.0.0.1:$FrontendPort/app?sniper_api=http://127.0.0.1:$SignalsApiPort"
Write-Output "LOCAL_SIGNALS_API=http://127.0.0.1:$SignalsApiPort"
Write-Output "LOCAL_COLLECTOR=http://127.0.0.1:$LegacyApiPort/dashboard"
Write-Output "LOG=$LocalLog"
