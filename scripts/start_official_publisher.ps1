param(
  [switch]$Quiet
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$LocalEnvPath = Join-Path $ScriptDir "official_publisher.local.env"
$PublisherScript = Join-Path $ScriptDir "official_dashboard_publisher.py"
$PortGuardScript = Join-Path $ScriptDir "sniper_port_guard.ps1"
$LogPath = Join-Path $ProjectRoot "official_dashboard_publisher.log"

function Read-LocalEnv($Path) {
  $values = @{}
  if (-not (Test-Path -LiteralPath $Path)) {
    return $values
  }

  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) {
      return
    }
    $matches = [regex]::Matches($line, "([A-Z0-9_]+)=(.*?)(?=\s+[A-Z0-9_]+=|$)")
    if ($matches.Count -gt 0) {
      foreach ($match in $matches) {
        $values[$match.Groups[1].Value.Trim()] = $match.Groups[2].Value.Trim().Trim('"').Trim("'")
      }
      return
    }
    $parts = $line.Split("=", 2)
    $values[$parts[0].Trim()] = $parts[1].Trim().Trim('"').Trim("'")
  }
  return $values
}

function Read-EnvValue($Values, $Name, $Default = "") {
  $processValue = [Environment]::GetEnvironmentVariable($Name, "Process")
  if ($processValue) {
    return $processValue
  }
  if ($Values.ContainsKey($Name)) {
    return [string]$Values[$Name]
  }
  return $Default
}

function Read-TokenFromEnvFile($Path, $Name) {
  if (-not $Path -or -not (Test-Path -LiteralPath $Path)) {
    return ""
  }
  $line = Get-Content -LiteralPath $Path | Where-Object { $_ -match "^$Name=" } | Select-Object -First 1
  if (-not $line) {
    return ""
  }
  return ([string]$line -replace "^$Name=", "").Trim().Trim('"').Trim("'")
}

function Get-PublisherProcesses {
  Get-CimInstance Win32_Process |
    Where-Object {
      $_.Name -match "python" -and
      $_.CommandLine -match "official_dashboard_publisher.py" -and
      $_.CommandLine -notmatch "legacy_collector_bridge\.log"
    }
}

function Set-ProcessEnv($StartInfo, $Name, $Value) {
  if ($null -ne $StartInfo.EnvironmentVariables) {
    $StartInfo.EnvironmentVariables[$Name] = [string]$Value
    return
  }
  $StartInfo.Environment[$Name] = [string]$Value
}

$localEnv = Read-LocalEnv $LocalEnvPath
$sourceEnvFile = Read-EnvValue $localEnv "SNIPER_SOURCE_ENV_FILE" $LocalEnvPath
if ($sourceEnvFile -match "2026-05-24|voc-um-desenvolvedor-python|sniper_bo_scraper") {
  $sourceEnvFile = $LocalEnvPath
}
$ProjectEnvPath = Join-Path $ProjectRoot ".env"
$pythonExe = Read-EnvValue $localEnv "PYTHON_EXE" "python.exe"
if ($pythonExe -match "2026-05-24|voc-um-desenvolvedor-python|sniper_bo_scraper") {
  $pythonExe = "python.exe"
}
$projectPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
if (Test-Path -LiteralPath $projectPython) {
  $pythonExe = $projectPython
}
$adminEmail = Read-EnvValue $localEnv "SNIPER_ADMIN_EMAIL"
$adminPassword = Read-EnvValue $localEnv "SNIPER_ADMIN_PASSWORD"
$adminToken = Read-EnvValue $localEnv "SNIPER_ADMIN_TOKEN"
$localDashboardToken = Read-EnvValue $localEnv "SNIPER_LOCAL_DASHBOARD_TOKEN"
if (-not $localDashboardToken) {
  $localDashboardToken = Read-TokenFromEnvFile $ProjectEnvPath "SNIPER_LOCAL_DASHBOARD_TOKEN"
}
if (-not $localDashboardToken) {
  $localDashboardToken = Read-TokenFromEnvFile $ProjectEnvPath "SNIPER_DASHBOARD_TOKEN"
}
if (-not $localDashboardToken) {
  $localDashboardToken = Read-TokenFromEnvFile $ProjectEnvPath "VITE_SNIPER_DASHBOARD_TOKEN"
}
$publisherToken = Read-EnvValue $localEnv "SNIPER_PUBLISHER_TOKEN"
if (-not $publisherToken) {
  $publisherToken = Read-TokenFromEnvFile $ProjectEnvPath "SNIPER_PUBLISHER_TOKEN"
}
$remoteDashboardToken = Read-EnvValue $localEnv "SNIPER_REMOTE_DASHBOARD_TOKEN"
if (-not $remoteDashboardToken) {
  $remoteDashboardToken = Read-EnvValue $localEnv "SNIPER_DASHBOARD_TOKEN"
}
if (-not $remoteDashboardToken) {
  $remoteDashboardToken = Read-TokenFromEnvFile $ProjectEnvPath "SNIPER_DASHBOARD_TOKEN"
}
$interval = Read-EnvValue $localEnv "PUBLISHER_INTERVAL" "0.2"
$frontendPort = [int](Read-EnvValue $localEnv "FRONTEND_PORT" "5175")
$signalsApiPort = [int](Read-EnvValue $localEnv "SIGNALS_API_PORT" "8787")
$localDashboardUrl = Read-EnvValue $localEnv "SNIPER_LOCAL_DASHBOARD_URL" "http://127.0.0.1:$signalsApiPort/dashboard"

if (-not $adminToken) {
  $adminToken = Read-TokenFromEnvFile $sourceEnvFile "SNIPER_ADMIN_TOKEN"
}
if (-not $localDashboardToken) {
  $localDashboardToken = $adminToken
}

$running = @(Get-PublisherProcesses)
if ($running.Count -gt 0) {
  foreach ($process in $running) {
    try {
      Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
    } catch {
      if (-not $Quiet) {
        Write-Output "failed to stop duplicate publisher pid=$($process.ProcessId): $($_.Exception.Message)"
      }
    }
  }
  Start-Sleep -Seconds 1
}

if (-not (Test-Path -LiteralPath $PublisherScript)) {
  throw "Publisher script not found: $PublisherScript"
}
if (Test-Path -LiteralPath $PortGuardScript) {
  & $PortGuardScript -FrontendPort $frontendPort -SignalsApiPort $signalsApiPort | Out-Null
}
if (-not $sourceEnvFile -or -not (Test-Path -LiteralPath $sourceEnvFile)) {
  $sourceEnvFile = $LocalEnvPath
}
if (-not $adminEmail -or -not $adminPassword -or -not $adminToken) {
  throw "SNIPER_ADMIN_EMAIL, SNIPER_ADMIN_PASSWORD and SNIPER_ADMIN_TOKEN are required."
}

$startInfo = New-Object System.Diagnostics.ProcessStartInfo
$startInfo.FileName = $pythonExe
$startInfo.Arguments = "scripts\official_dashboard_publisher.py --env-file `"$sourceEnvFile`" --local-url `"$localDashboardUrl`" --interval $interval --repeat-interval 2.0 --remote-timeout 2.0 --urgent-signal --urgent-retry-interval 0.2 --non-entry-urgent-interval 0.2 --full-dashboard --log-file official_dashboard_publisher.log"
$startInfo.WorkingDirectory = $ProjectRoot
$startInfo.UseShellExecute = $false
$startInfo.CreateNoWindow = $true
$startInfo.RedirectStandardOutput = $false
$startInfo.RedirectStandardError = $false
Set-ProcessEnv $startInfo "SNIPER_ADMIN_EMAIL" $adminEmail
Set-ProcessEnv $startInfo "SNIPER_ADMIN_PASSWORD" $adminPassword
Set-ProcessEnv $startInfo "SNIPER_ADMIN_TOKEN" $adminToken
Set-ProcessEnv $startInfo "SNIPER_LOCAL_DASHBOARD_TOKEN" $localDashboardToken
if ($publisherToken) {
  Set-ProcessEnv $startInfo "SNIPER_PUBLISHER_TOKEN" $publisherToken
}
if ($remoteDashboardToken) {
  Set-ProcessEnv $startInfo "SNIPER_REMOTE_DASHBOARD_TOKEN" $remoteDashboardToken
}
Set-ProcessEnv $startInfo "FRONTEND_PORT" $frontendPort
Set-ProcessEnv $startInfo "SIGNALS_API_PORT" $signalsApiPort

[System.Diagnostics.Process]::Start($startInfo) | Out-Null

if (-not $Quiet) {
  Start-Sleep -Seconds 2
  $afterStart = @(Get-PublisherProcesses)
  Write-Output "official publisher started: $($afterStart.ProcessId -join ', ')"
  Write-Output "log: $LogPath"
}
