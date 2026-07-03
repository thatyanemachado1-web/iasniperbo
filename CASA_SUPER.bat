@echo off
chcp 65001 >nul
title SNIPERBO - Casa Super (nao Score)
cd /d "%~dp0"
echo.
echo Corrigindo para Casa Super 77super.com...
echo.
if not exist "%~dp0scripts\super_casino.local.env" (
  echo Primeira vez: configure login da Super...
  call "%~dp0LOGIN_SUPER.bat"
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\corrigir_para_super.ps1"
echo.
pause
