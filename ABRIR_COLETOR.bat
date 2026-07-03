@echo off
chcp 65001 >nul
title SNIPERBO - Coletor da Mesa
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\abrir_coletor_visivel.ps1"
echo.
pause
