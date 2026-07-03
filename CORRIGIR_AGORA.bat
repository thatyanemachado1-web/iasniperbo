@echo off
chcp 65001 >nul
title SNIPERBO - Corrigir scripts e reiniciar
set "DEST=C:\SNIPERBO"
set "BRANCH=cursor/fix-collector-401-f115"
set "ZIP=%TEMP%\sniperbo-fix.zip"
set "EXTRACT=%TEMP%\sniperbo-fix-extract"
set "ADMIN_EMAIL=gabrielmendespromove@gmail.com"
set "ADMIN_PASS=AdminSniper2026!"

echo.
echo ================================================
echo   SNIPERBO - Corrigindo scripts (401 publish)
echo ================================================
echo.

if not exist "%DEST%" mkdir "%DEST%"
cd /d "%DEST%"

echo [1/5] Parando processos duplicados...
for /f "tokens=2" %%P in ('wmic process where "commandline like '%%official_dashboard_publisher.py%%'" get processid /format:list 2^>nul ^| find "="') do taskkill /F /PID %%P 2>nul
for /f "tokens=2" %%P in ('wmic process where "commandline like '%%sniper_bo_scraper.py%%'" get processid /format:list 2^>nul ^| find "="') do taskkill /F /PID %%P 2>nul
for /f "tokens=2" %%P in ('wmic process where "commandline like '%%watch_sniperbo_official.ps1%%'" get processid /format:list 2^>nul ^| find "="') do taskkill /F /PID %%P 2>nul
timeout /t 2 /nobreak >nul

echo [2/5] Baixando correcoes do GitHub (branch %BRANCH%)...
powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri 'https://github.com/thatyanemachado1-web/iasniperbo/archive/refs/heads/%BRANCH%.zip' -OutFile '%ZIP%' -UseBasicParsing"
if errorlevel 1 (
  echo ERRO ao baixar. Verifique internet.
  pause
  exit /b 1
)

echo [3/5] Copiando scripts corrigidos...
if exist "%EXTRACT%" rmdir /s /q "%EXTRACT%" 2>nul
powershell -NoProfile -Command "Expand-Archive -Path '%ZIP%' -DestinationPath '%EXTRACT%' -Force"
set "SRC=%EXTRACT%\iasniperbo-%BRANCH%"
if not exist "%SRC%" set "SRC=%EXTRACT%\iasniperbo-cursor-fix-collector-401-f115"
xcopy "%SRC%\scripts\*" "%DEST%\scripts\" /E /Y /I /Q >nul
copy /Y "%SRC%\DIAGNOSTICAR_SINAIS.bat" "%DEST\" >nul 2>nul
copy /Y "%SRC%\REINICIAR_SINAIS.bat" "%DEST\" >nul 2>nul
copy /Y "%SRC%\LIGAR_SINAIS.bat" "%DEST\" >nul 2>nul
copy /Y "%SRC%\VERIFICAR_SINAIS.bat" "%DEST\" >nul 2>nul

echo [4/5] Copiando config.json se existir...
if exist "%DEST%\scripts\copiar_config_coletor.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%DEST%\scripts\copiar_config_coletor.ps1" 2>nul
)

echo [5/5] Credenciais + ligar sinais...
powershell -NoProfile -ExecutionPolicy Bypass -File "%DEST%\scripts\configurar_publisher_credenciais.ps1" -AdminEmail "%ADMIN_EMAIL%" -AdminPassword "%ADMIN_PASS%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%DEST%\scripts\ligar_sinais.ps1"

echo.
echo ================================================
echo   Correcao aplicada!
echo   Agora rode: DIAGNOSTICAR_SINAIS.bat
echo ================================================
echo.
pause
