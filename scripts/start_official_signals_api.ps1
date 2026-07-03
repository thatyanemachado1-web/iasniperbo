param(
  [int]$SignalsApiPort = 8787,
  [int]$FrontendPort = 5175
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$LogDir = Join-Path $ProjectRoot "logs"
$StartupLog = Join-Path $LogDir "signals_api_startup.log"
$RuntimeLog = Join-Path $LogDir "signals_api_runtime.log"

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

function Write-StartupLog($Message) {
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -LiteralPath $StartupLog -Value "$timestamp $Message"
}

function Test-SignalsHealth {
  try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:$SignalsApiPort/health" -TimeoutSec 3
    return $response.status -eq "online" -and $response.service -eq "signals-api" -and [int]$response.port -eq $SignalsApiPort
  } catch {
    return $false
  }
}

if (Test-SignalsHealth) {
  Write-StartupLog "signals api already healthy port=$SignalsApiPort"
  exit 0
}

$listeners = @(Get-NetTCPConnection -LocalPort $SignalsApiPort -State Listen -ErrorAction SilentlyContinue)
foreach ($listener in $listeners) {
  try {
    Stop-Process -Id $listener.OwningProcess -Force -ErrorAction Stop
    Write-StartupLog "stopped invalid listener port=$SignalsApiPort pid=$($listener.OwningProcess)"
  } catch {
    Write-StartupLog "failed to stop invalid listener port=$SignalsApiPort pid=$($listener.OwningProcess) error=$($_.Exception.Message)"
  }
}

$serverEntry = Join-Path $ProjectRoot "dist\server\server.js"
$srvxEntry = Join-Path $ProjectRoot "node_modules\srvx\bin\srvx.mjs"

if (-not (Test-Path -LiteralPath $serverEntry)) {
  Write-StartupLog "dist server missing path=$serverEntry"
  throw "dist/server/server.js not found. Run npm run build before starting the signals API."
}

if (-not (Test-Path -LiteralPath $srvxEntry)) {
  Write-StartupLog "srvx missing path=$srvxEntry"
  throw "srvx not found in node_modules."
}

$nodePath = (Get-Command node.exe -ErrorAction Stop).Source
$processInfo = New-Object System.Diagnostics.ProcessStartInfo
$processInfo.FileName = $nodePath
$processInfo.Arguments = "`"$srvxEntry`" --prod --port $SignalsApiPort --host 127.0.0.1 `"dist\server`""
$processInfo.WorkingDirectory = $ProjectRoot
$processInfo.UseShellExecute = $false
$processInfo.CreateNoWindow = $true

function Set-ProcessEnv($ProcessInfo, $Name, $Value) {
  if ($null -eq $ProcessInfo.EnvironmentVariables) {
    Set-Item -Path "Env:$Name" -Value ([string]$Value)
  } elseif ($ProcessInfo.EnvironmentVariables.ContainsKey($Name)) {
    $ProcessInfo.EnvironmentVariables[$Name] = [string]$Value
  } else {
    $ProcessInfo.EnvironmentVariables.Add($Name, [string]$Value)
  }
}

Set-ProcessEnv $processInfo "PORT" $SignalsApiPort
Set-ProcessEnv $processInfo "NITRO_PORT" $SignalsApiPort
Set-ProcessEnv $processInfo "HOST" "127.0.0.1"
Set-ProcessEnv $processInfo "SIGNALS_API_PORT" $SignalsApiPort
Set-ProcessEnv $processInfo "FRONTEND_PORT" $FrontendPort

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
