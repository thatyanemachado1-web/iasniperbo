param(
  [int]$SignalsApiPort = 8787,
  [int]$FrontendPort = 5175
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$LogDir = Join-Path $ProjectRoot "logs"
$StartupLog = Join-Path $LogDir "signals_api_startup.log"
$EnvPath = Join-Path $ProjectRoot ".env"
$LocalPublisherEnvPath = Join-Path $ScriptDir "official_publisher.local.env"
$ExternalPublisherEnvPath = "C:\SNIPERBO\scripts\official_publisher.local.env"

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
    $name = $parts[0].Trim()
    $value = $parts[1].Trim().Trim('"').Trim("'")
    if ($name) { $values[$name] = $value }
  }

  return $values
}

function Set-ProcessEnv($ProcessInfo, $Name, $Value) {
  if ($ProcessInfo.EnvironmentVariables.ContainsKey($Name)) {
    $ProcessInfo.EnvironmentVariables[$Name] = [string]$Value
  } else {
    $ProcessInfo.EnvironmentVariables.Add($Name, [string]$Value)
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

function Get-ProcessCommandLine($ProcessId) {
  try {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction SilentlyContinue
    if ($process) { return [string]$process.CommandLine }
  } catch {}
  return ""
}

if (Test-SignalsHealth) {
  $listener = Get-NetTCPConnection -LocalPort $SignalsApiPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  $commandLine = if ($listener) { Get-ProcessCommandLine $listener.OwningProcess } else { "" }
  if ($commandLine -like "*$ProjectRoot*") {
    Write-StartupLog "signals api already healthy port=$SignalsApiPort"
    exit 0
  }
}

$listeners = @(Get-NetTCPConnection -LocalPort $SignalsApiPort -State Listen -ErrorAction SilentlyContinue)
foreach ($listener in $listeners) {
  try {
    Stop-Process -Id $listener.OwningProcess -Force -ErrorAction Stop
    Write-StartupLog "stopped listener port=$SignalsApiPort pid=$($listener.OwningProcess)"
  } catch {
    Write-StartupLog "failed to stop listener port=$SignalsApiPort pid=$($listener.OwningProcess) error=$($_.Exception.Message)"
  }
}

$outputServerDir = Join-Path $ProjectRoot ".output\server\_ssr"
$outputRootServerDir = Join-Path $ProjectRoot ".output\server"
$distServerDir = Join-Path $ProjectRoot "dist\server"
$outputServerIndex = Join-Path $outputServerDir "index.mjs"
$outputServerEntry = Join-Path $outputServerDir "server.js"
$outputRootServerEntry = Join-Path $outputRootServerDir "index.mjs"
$distServerEntry = Join-Path $distServerDir "server.js"
$srvxEntry = Join-Path $ProjectRoot "node_modules\srvx\bin\srvx.mjs"

if (Test-Path -LiteralPath $outputServerIndex) {
  $shouldRefreshOutputEntry = -not (Test-Path -LiteralPath $outputServerEntry)
  if (-not $shouldRefreshOutputEntry) {
    $shouldRefreshOutputEntry = (Get-Item -LiteralPath $outputServerIndex).LastWriteTime -gt (Get-Item -LiteralPath $outputServerEntry).LastWriteTime
  }
  if ($shouldRefreshOutputEntry) {
    Copy-Item -LiteralPath $outputServerIndex -Destination $outputServerEntry -Force
    Write-StartupLog "refreshed output server entry path=$outputServerEntry"
  }
}

$serverDir = $outputRootServerDir
$serverEntry = $outputRootServerEntry
if (-not (Test-Path -LiteralPath $serverEntry)) {
  $serverDir = $outputServerDir
  $serverEntry = $outputServerEntry
}
if (-not (Test-Path -LiteralPath $serverEntry)) {
  $serverDir = $distServerDir
  $serverEntry = $distServerEntry
}

if (-not (Test-Path -LiteralPath $serverEntry)) {
  Write-StartupLog "server bundle missing output=$outputRootServerEntry ssr=$outputServerEntry dist=$distServerEntry"
  throw "Server bundle not found. Run npm run build before starting the local signals API."
}

if (-not (Test-Path -LiteralPath $srvxEntry)) {
  Write-StartupLog "srvx missing path=$srvxEntry"
  throw "srvx not found in node_modules."
}

$nodePath = (Get-Command node.exe -ErrorAction Stop).Source
$processInfo = New-Object System.Diagnostics.ProcessStartInfo
$processInfo.FileName = $nodePath
$relativeServerDir = Resolve-Path -LiteralPath $serverDir -Relative
$processInfo.Arguments = "`"$srvxEntry`" --prod --port $SignalsApiPort --host 127.0.0.1 `"$relativeServerDir`""
$processInfo.WorkingDirectory = $ProjectRoot
$processInfo.UseShellExecute = $false
$processInfo.CreateNoWindow = $true

$localEnv = Read-EnvFile $EnvPath
foreach ($name in $localEnv.Keys) {
  Set-ProcessEnv $processInfo $name $localEnv[$name]
}

$publisherEnv = Read-EnvFile $LocalPublisherEnvPath
foreach ($name in $publisherEnv.Keys) {
  if (-not $localEnv.ContainsKey($name)) {
    Set-ProcessEnv $processInfo $name $publisherEnv[$name]
  }
}

$externalPublisherEnv = Read-EnvFile $ExternalPublisherEnvPath
foreach ($name in $externalPublisherEnv.Keys) {
  if ($name -like "SNIPER_*" -or $name -in @("SIGNALS_API_PORT", "FRONTEND_PORT")) {
    Set-ProcessEnv $processInfo $name $externalPublisherEnv[$name]
  }
}

Set-ProcessEnv $processInfo "PORT" $SignalsApiPort
Set-ProcessEnv $processInfo "NITRO_PORT" $SignalsApiPort
Set-ProcessEnv $processInfo "HOST" "127.0.0.1"
Set-ProcessEnv $processInfo "SIGNALS_API_PORT" $SignalsApiPort
Set-ProcessEnv $processInfo "FRONTEND_PORT" $FrontendPort
Set-ProcessEnv $processInfo "SNIPER_LOCAL_MODE" "1"

$process = [System.Diagnostics.Process]::Start($processInfo)
Write-StartupLog "started signals api port=$SignalsApiPort pid=$($process.Id)"

for ($attempt = 1; $attempt -le 12; $attempt++) {
  Start-Sleep -Seconds 1
  if (Test-SignalsHealth) {
    Write-StartupLog "signals api health ok port=$SignalsApiPort pid=$($process.Id)"
    exit 0
  }
}

Write-StartupLog "signals api health failed port=$SignalsApiPort pid=$($process.Id)"
exit 1
