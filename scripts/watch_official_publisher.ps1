$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$OfficialWatchdog = Join-Path $ScriptDir "watch_sniperbo_official.ps1"
& $OfficialWatchdog @args
