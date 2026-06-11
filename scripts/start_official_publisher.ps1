param(
  [switch]$Quiet
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$LocalEnvPath = Join-Path $ScriptDir "official_publisher.local.env"
$PublisherScript = Join-Path $ScriptDir "official_dashboard_publisher.py"
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
      $_.CommandLine -match "official_dashboard_publisher.py"
    }
}

$running = @(Get-PublisherProcesses)
if ($running.Count -gt 0) {
  if (-not $Quiet) {
    Write-Output "official publisher already running: $($running.ProcessId -join ', ')"
  }
  exit 0
}

$localEnv = Read-LocalEnv $LocalEnvPath
$sourceEnvFile = Read-EnvValue $localEnv "SNIPER_SOURCE_ENV_FILE"
$pythonExe = Read-EnvValue $localEnv "PYTHON_EXE" "python.exe"
$adminEmail = Read-EnvValue $localEnv "SNIPER_ADMIN_EMAIL"
$adminPassword = Read-EnvValue $localEnv "SNIPER_ADMIN_PASSWORD"
$adminToken = Read-EnvValue $localEnv "SNIPER_ADMIN_TOKEN"
$interval = Read-EnvValue $localEnv "PUBLISHER_INTERVAL" "0.7"

if (-not $adminToken) {
  $adminToken = Read-TokenFromEnvFile $sourceEnvFile "SNIPER_ADMIN_TOKEN"
}

if (-not (Test-Path -LiteralPath $PublisherScript)) {
  throw "Publisher script not found: $PublisherScript"
}
if (-not $sourceEnvFile) {
  throw "SNIPER_SOURCE_ENV_FILE is required in $LocalEnvPath"
}
if (-not $adminEmail -or -not $adminPassword -or -not $adminToken) {
  throw "SNIPER_ADMIN_EMAIL, SNIPER_ADMIN_PASSWORD and SNIPER_ADMIN_TOKEN are required."
}

$startInfo = New-Object System.Diagnostics.ProcessStartInfo
$startInfo.FileName = $pythonExe
$startInfo.Arguments = "scripts\official_dashboard_publisher.py --env-file `"$sourceEnvFile`" --interval $interval --log-file official_dashboard_publisher.log"
$startInfo.WorkingDirectory = $ProjectRoot
$startInfo.UseShellExecute = $false
$startInfo.CreateNoWindow = $true
$startInfo.RedirectStandardOutput = $false
$startInfo.RedirectStandardError = $false
$startInfo.EnvironmentVariables["SNIPER_ADMIN_EMAIL"] = $adminEmail
$startInfo.EnvironmentVariables["SNIPER_ADMIN_PASSWORD"] = $adminPassword
$startInfo.EnvironmentVariables["SNIPER_ADMIN_TOKEN"] = $adminToken

[System.Diagnostics.Process]::Start($startInfo) | Out-Null

if (-not $Quiet) {
  Start-Sleep -Seconds 2
  $afterStart = @(Get-PublisherProcesses)
  Write-Output "official publisher started: $($afterStart.ProcessId -join ', ')"
  Write-Output "log: $LogPath"
}
