@echo off
cd /d "%~dp0"
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\diagnosticar_sinais.ps1" -ProjectRoot "%ROOT%"
pause
