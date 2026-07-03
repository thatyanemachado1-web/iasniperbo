@echo off
chcp 65001 >nul
title SNIPERBO - Ligando sinais
cd /d "%~dp0"

echo.
echo ========================================
echo   SNIPERBO - Ligando sinais reais
echo ========================================
echo.
echo Pasta: %CD%
echo.

if not exist "%~dp0scripts\official_dashboard_publisher.py" (
  echo ERRO: Arquivo nao encontrado:
  echo   %~dp0scripts\official_dashboard_publisher.py
  echo.
  echo Voce esta na pasta certa? Deve ser C:\SNIPERBO
  echo Rode VERIFICAR_SINAIS.bat primeiro.
  pause
  exit /b 1
)

if not exist "%~dp0scripts\configurar_publisher_credenciais.ps1" (
  echo ERRO: Arquivo nao encontrado:
  echo   %~dp0scripts\configurar_publisher_credenciais.ps1
  echo.
  echo Atualize o projeto: git pull origin main
  pause
  exit /b 1
)

if not exist "%~dp0sniper_bo_scraper.py" (
  echo.
  echo AVISO IMPORTANTE:
  echo   sniper_bo_scraper.py NAO encontrado em:
  echo   %CD%
  echo.
  echo Sem esse arquivo o coletor da mesa NAO funciona.
  echo Procure no PC e copie sniper_bo_scraper.py para esta pasta.
  echo.
  pause
)

where powershell >nul 2>&1
if errorlevel 1 (
  echo ERRO: PowerShell nao encontrado no Windows.
  pause
  exit /b 1
)

where git >nul 2>&1
if not errorlevel 1 (
  echo Atualizando projeto...
  git pull origin main 2>nul
)

echo.
echo [1/2] Configurando credenciais...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\configurar_publisher_credenciais.ps1" -AdminEmail "gabrielmendespromove@gmail.com" -AdminPassword "AdminSniper2026!"
if errorlevel 1 (
  echo.
  echo ERRO ao configurar credenciais.
  pause
  exit /b 1
)

echo.
echo [2/2] Ligando coletor e publisher...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\ligar_sinais.ps1"

echo.
echo ========================================
echo   Fim. Site: https://sniperbo.com/app
echo   Log: %~dp0official_dashboard_publisher.log
echo ========================================
echo.
pause
