@echo off
chcp 65001 >nul
title SNIPERBO - Clique aqui
cd /d "%~dp0"

echo.
echo ================================================
echo   SNIPERBO - Um clique so
echo ================================================
echo.

if not exist "%~dp0scripts\official_dashboard_publisher.py" (
  echo Instalando arquivos...
  call "%~dp0INSTALAR_TUDO.bat"
  exit /b %ERRORLEVEL%
)

if not exist "%~dp0config.json" (
  echo Passo 1: Abrindo mesa Bac Bo no Chrome...
  call "%~dp0ABRIR_MESA.bat"
)

echo.
echo Passo 2: Ligando sinais para o site...
call "%~dp0REINICIAR_SINAIS.bat"
