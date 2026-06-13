param(
  [int]$IntervalSeconds = 15,
  [int]$FrontendPort = $(if ($env:FRONTEND_PORT) { [int]$env:FRONTEND_PORT } else { 5175 }),
  [int]$SignalsApiPort = $(if ($env:SIGNALS_API_PORT) { [int]$env:SIGNALS_API_PORT } else { 8787 }),
  [switch]$Once
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$LogDir = Join-Path $ProjectRoot "logs"
$WatchLog = Join-Path $LogDir "sniperbo_official_watchdog.log"
$PortGuardScript = Join-Path $ScriptDir "sniper_port_guard.ps1"
$StartPublisherScript = Join-Path $ScriptDir "start_official_publisher.ps1"
$StartSignalsScript = Join-Path $ScriptDir "start_official_signals_api.ps1"

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

function Write-WatchLog($Message) {
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -LiteralPath $WatchLog -Value "$timestamp $Message"
}

function Get-ProcessCommandLine($ProcessId) {
  try {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction SilentlyContinue
    if (-not $process) { return "" }
    return [string]$process.CommandLine
  } catch {
    Write-WatchLog "command line unavailable pid=$ProcessId error=$($_.Exception.Message)"
    return ""
  }
}

function Get-ProcessRecords {
  try {
    return @(Get-CimInstance Win32_Process -Property ProcessId,Name,CommandLine -ErrorAction Stop |
      ForEach-Object {
        [pscustomobject]@{
          ProcessId = $_.ProcessId
          Name = [string]$_.Name
          CommandLine = [string]$_.CommandLine
        }
      })
  } catch {
    Write-WatchLog "full process scan denied; using fallback: $($_.Exception.Message)"
  }

  @(Get-Process -ErrorAction SilentlyContinue |
    Where-Object { @("node", "cmd", "python", "powershell", "pwsh") -contains $_.ProcessName.ToLowerInvariant() } |
    ForEach-Object {
      [pscustomobject]@{
        ProcessId = $_.Id
        Name = $_.ProcessName
        CommandLine = Get-ProcessCommandLine $_.Id
      }
    })
}

function Stop-SafeProcess($ProcessId, $Reason) {
  if ($ProcessId -eq $PID) { return }
  try {
    Stop-Process -Id $ProcessId -Force -ErrorAction Stop
    Write-WatchLog "stopped pid=$ProcessId reason=$Reason"
  } catch {
    Write-WatchLog "failed to stop pid=$ProcessId reason=$Reason error=$($_.Exception.Message)"
  }
}

function Test-Url($Url) {
  try {
    $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 3 -UseBasicParsing
    return [int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Test-SignalsHealth {
  try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:$SignalsApiPort/health" -TimeoutSec 3
    return $response.status -eq "online" -and $response.service -eq "signals-api" -and [int]$response.port -eq $SignalsApiPort
  } catch {
    return $false
  }
}

function Get-Listeners($Port) {
  @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object {
      [pscustomobject]@{
        Port = $_.LocalPort
        PID = $_.OwningProcess
        CommandLine = Get-ProcessCommandLine $_.OwningProcess
      }
    })
}

function Get-OfficialFrontendProcesses($Processes) {
  @($Processes | Where-Object {
    $_.CommandLine -match [regex]::Escape($ProjectRoot) -and
    $_.CommandLine -match "vite" -and
    $_.CommandLine -match "--port\s+$FrontendPort"
  })
}

function Get-OfficialPublisherProcesses($Processes) {
  try {
    $directMatches = @(Get-CimInstance Win32_Process -Property ProcessId,Name,CommandLine -ErrorAction Stop |
      Where-Object {
        $_.Name -match "python" -and
        $_.CommandLine -like "*official_dashboard_publisher.py*"
      } |
      ForEach-Object {
        [pscustomobject]@{
          ProcessId = $_.ProcessId
          Name = [string]$_.Name
          CommandLine = [string]$_.CommandLine
        }
      })
    if ($directMatches.Count -gt 0) {
      return $directMatches
    }
  } catch {
    Write-WatchLog "publisher direct scan failed: $($_.Exception.Message)"
  }

  return @($Processes | Where-Object {
    $_.Name -match "python" -and
    $_.CommandLine -like "*official_dashboard_publisher.py*"
  })
}

function Stop-OldSniperPackage($Processes) {
  $markers = @("start_sniperbo_auto.ps1", "sniper_bo_scraper.py", "2026-05-24\\voc-um-desenvolvedor-python")
  foreach ($process in $Processes) {
    foreach ($marker in $markers) {
      if ($process.CommandLine -like "*$marker*") {
        if ($process.CommandLine -match "official_dashboard_publisher.py") { continue }
        Stop-SafeProcess $process.ProcessId "old-sniper-autostart"
        break
      }
    }
  }
}

function Clean-LocalDuplicates($Processes) {
  $vitePorts = @(5174, 5175, 5180)
  foreach ($port in $vitePorts) {
    foreach ($listener in Get-Listeners $port) {
      $isSniper = $listener.CommandLine -match [regex]::Escape($ProjectRoot)
      if ($port -eq $FrontendPort) {
        if (-not $isSniper) {
          Write-WatchLog "frontend port $FrontendPort is used by another project pid=$($listener.PID)"
        }
        continue
      }
      if ($listener.CommandLine -match "vite") {
        Stop-SafeProcess $listener.PID "duplicate-local-vite-port-$port"
      } else {
        Write-WatchLog "ignored non-vite local app port=$port pid=$($listener.PID)"
      }
    }
  }

  foreach ($listener in Get-Listeners 8899) {
    if ($listener.CommandLine -match "\bserver\.js\b") {
      Stop-SafeProcess $listener.PID "stale-signals-server-wrong-port-8899"
    }
  }
}

function Ensure-Frontend($Processes) {
  $frontendOk = Test-Url "http://127.0.0.1:$FrontendPort/"
  $frontendProcesses = Get-OfficialFrontendProcesses $Processes
  $frontendListeners = @(Get-Listeners $FrontendPort | Where-Object {
    $_.CommandLine -match [regex]::Escape($ProjectRoot)
  })

  if ($frontendProcesses.Count -gt 1) {
    $frontendProcesses | Sort-Object ProcessId | Select-Object -Skip 1 | ForEach-Object {
      Stop-SafeProcess $_.ProcessId "duplicate-sniper-frontend"
    }
    $frontendProcesses = @(Get-OfficialFrontendProcesses (Get-ProcessRecords))
  }

  if (($frontendOk -or $frontendListeners.Count -gt 0) -and ($frontendProcesses.Count -gt 0 -or $frontendListeners.Count -gt 0)) {
    $pidText = if ($frontendListeners.Count -gt 0) { $frontendListeners[0].PID } else { $frontendProcesses[0].ProcessId }
    Write-WatchLog "frontend ok port=$FrontendPort pid=$pidText"
    return
  }

  Write-WatchLog "frontend down; starting port=$FrontendPort"
  $npm = "C:\Program Files\nodejs\npm.cmd"
  $processInfo = New-Object System.Diagnostics.ProcessStartInfo
  $processInfo.FileName = "$env:SystemRoot\System32\cmd.exe"
  $processInfo.Arguments = "/d /s /c `"`"$npm`" run dev -- --host 127.0.0.1 --port $FrontendPort --strictPort`""
  $processInfo.WorkingDirectory = $ProjectRoot
  $processInfo.UseShellExecute = $false
  $processInfo.CreateNoWindow = $true
  [System.Diagnostics.Process]::Start($processInfo) | Out-Null
}

function Ensure-SignalsApi {
  if (Test-SignalsHealth) {
    $listener = Get-Listeners $SignalsApiPort | Select-Object -First 1
    Write-WatchLog "signals api ok port=$SignalsApiPort pid=$($listener.PID)"
    return
  }

  foreach ($listener in Get-Listeners $SignalsApiPort) {
    Stop-SafeProcess $listener.PID "invalid-signals-api-health"
  }

  Write-WatchLog "signals api down; starting port=$SignalsApiPort"
  & $StartSignalsScript -SignalsApiPort $SignalsApiPort -FrontendPort $FrontendPort | Out-Null
  Start-Sleep -Seconds 4

  if (Test-SignalsHealth) {
    $listener = Get-Listeners $SignalsApiPort | Select-Object -First 1
    Write-WatchLog "signals api recovered port=$SignalsApiPort pid=$($listener.PID)"
  } else {
    Write-WatchLog "signals api failed health after restart port=$SignalsApiPort"
  }
}

function Ensure-Publisher($Processes) {
  $publishers = @(Get-OfficialPublisherProcesses $Processes)
  if ($publishers.Count -gt 1) {
    $publishers | Sort-Object ProcessId | Select-Object -Skip 1 | ForEach-Object {
      Stop-SafeProcess $_.ProcessId "duplicate-official-publisher"
    }
    $publishers = @(Get-OfficialPublisherProcesses (Get-ProcessRecords))
  }

  if ($publishers.Count -eq 1) {
    Write-WatchLog "publisher ok pid=$($publishers[0].ProcessId)"
    return
  }

  Write-WatchLog "publisher down; starting"
  & $StartPublisherScript -Quiet
}

function Run-WatchdogTick {
  if (Test-Path -LiteralPath $PortGuardScript) {
    & $PortGuardScript -FrontendPort $FrontendPort -SignalsApiPort $SignalsApiPort | Out-Null
  }

  $processes = Get-ProcessRecords
  Stop-OldSniperPackage $processes
  Clean-LocalDuplicates $processes
  Ensure-Frontend $processes
  Ensure-SignalsApi
  $processes = Get-ProcessRecords
  Ensure-Publisher $processes
}

Write-WatchLog "official watchdog started frontend=$FrontendPort signals=$SignalsApiPort"

do {
  try {
    Run-WatchdogTick
  } catch {
    Write-WatchLog "watchdog error: $($_.Exception.Message)"
  }

  if ($Once) { break }
  Start-Sleep -Seconds ([Math]::Max(5, $IntervalSeconds))
} while ($true)
