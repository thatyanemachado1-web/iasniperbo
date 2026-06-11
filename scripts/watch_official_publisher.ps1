param(
  [int]$IntervalSeconds = 15
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$StartScript = Join-Path $ScriptDir "start_official_publisher.ps1"
$WatchLog = Join-Path $ProjectRoot "official_dashboard_watchdog.log"

function Write-WatchLog($Message) {
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -LiteralPath $WatchLog -Value "$timestamp $Message"
}

function Get-PublisherProcesses {
  Get-CimInstance Win32_Process |
    Where-Object {
      $_.Name -match "python" -and
      $_.CommandLine -match "official_dashboard_publisher.py"
    }
}

Write-WatchLog "watchdog started"

while ($true) {
  try {
    $running = @(Get-PublisherProcesses)
    if ($running.Count -eq 0) {
      Write-WatchLog "publisher not running; starting"
      & $StartScript -Quiet
      Start-Sleep -Seconds 3
      $running = @(Get-PublisherProcesses)
      Write-WatchLog "publisher processes: $($running.ProcessId -join ', ')"
    }
  } catch {
    Write-WatchLog "watchdog error: $($_.Exception.Message)"
  }

  Start-Sleep -Seconds ([Math]::Max(5, $IntervalSeconds))
}
