@echo off
chcp 65001 >nul
title SNIPERBO - Login automatico Super
cd /d "%~dp0"
echo.
echo Configurando login automatico da Casa Super (77super.com)...
echo.
if "%~1"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\configurar_login_super.ps1"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\configurar_login_super.ps1" -SuperEmail "%~1" -SuperPassword "%~2"
)
if errorlevel 1 goto :err
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\corrigir_para_super.ps1" -SkipOpenMesa
echo.
echo Login Super configurado. Agora rode REINICIAR_SINAIS.bat
goto :done
:err
echo.
echo ERRO ao configurar login Super.
:done
pause
