@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\diagnosticar_sinais.ps1" -ProjectRoot "%~dp0"
pause
