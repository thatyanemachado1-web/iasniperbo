param(
  [int]$LegacyApiPort = 8791,
  [int]$SignalsApiPort = 8787,
  [int]$IntervalSeconds = 10
)

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$LogDir = Join-Path $ProjectRoot "logs"
$WatchLog = Join-Path $LogDir "local_bridge_watchdog.log"
$StartBridgeScript = Join-Path $ScriptDir "start_legacy_collector_bridge.ps1"

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

function Write-WatchLog($Message) {
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -LiteralPath $WatchLog -Value "$timestamp $Message"
}

Write-WatchLog "watchdog starting legacy=$LegacyApiPort signals=$SignalsApiPort"
while ($true) {
  try {
    & $StartBridgeScript -LegacyApiPort $LegacyApiPort -SignalsApiPort $SignalsApiPort -Quiet
  } catch {
    Write-WatchLog "watchdog iteration failed: $($_.Exception.Message)"
  }
  Start-Sleep -Seconds $IntervalSeconds
}
