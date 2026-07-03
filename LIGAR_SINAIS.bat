@echo off
chcp 65001 >nul
title SNIPERBO - Ligando sinais
cd /d "%~dp0"

echo.
echo ========================================
echo   SNIPERBO - Ligando sinais reais
echo ========================================
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo [AVISO] Git nao encontrado. Continuando sem git pull...
) else (
  echo Atualizando projeto...
  git pull origin main 2>nul
)

echo.
echo [1/2] Configurando credenciais...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\configurar_publisher_credenciais.ps1" -AdminEmail "gabrielmendespromove@gmail.com" -AdminPassword "AdminSniper2026!"
if errorlevel 1 (
  echo.
  echo ERRO ao configurar credenciais. Veja a mensagem acima.
  pause
  exit /b 1
)

echo.
echo [2/2] Ligando coletor, publisher e watchdog...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\ligar_sinais.ps1"
if errorlevel 1 (
  echo.
  echo ERRO ao ligar sinais. Veja a mensagem acima.
  pause
  exit /b 1
)

echo.
echo ========================================
echo   Pronto! Abra: https://sniperbo.com/app
echo   Log: %~dp0official_dashboard_publisher.log
echo ========================================
echo.
pause
