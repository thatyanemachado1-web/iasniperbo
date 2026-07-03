@echo off
chcp 65001 >nul
title SNIPERBO - Coletor
cd /d "C:\SNIPERBO"
set "ROOT=C:\SNIPERBO"

if exist "%ROOT%\.venv\Scripts\python.exe" (
  set "PY=%ROOT%\.venv\Scripts\python.exe"
) else (
  set "PY=python"
)

if not exist "%ROOT%\sniper_bo_scraper.py" (
  echo ERRO: falta C:\SNIPERBO\sniper_bo_scraper.py
  pause
  exit /b 1
)

"%PY%" "%ROOT%\scripts\fix_collector_config.py" "%ROOT%"

for /f "usebackq tokens=1,* delims==" %%A in ("%ROOT%\scripts\official_publisher.local.env") do (
  if "%%A"=="SNIPER_ADMIN_TOKEN" set "SNIPER_ADMIN_TOKEN=%%B"
  if "%%A"=="SNIPER_ADMIN_EMAIL" set "SNIPER_ADMIN_EMAIL=%%B"
  if "%%A"=="SNIPER_ADMIN_PASSWORD" set "SNIPER_ADMIN_PASSWORD=%%B"
)
if exist "%ROOT%\collector_login.local.env" for /f "usebackq tokens=1,* delims==" %%A in ("%ROOT%\collector_login.local.env") do (
  if "%%A"=="COLLECTOR_LOGIN_EMAIL" set "COLLECTOR_LOGIN_EMAIL=%%B"
  if "%%A"=="COLLECTOR_LOGIN_PASSWORD" set "COLLECTOR_LOGIN_PASSWORD=%%B"
)

set SNIPER_ADMIN_API_ENABLED=1
set SNIPER_ADMIN_API_HOST=127.0.0.1
set SNIPER_ADMIN_API_PORT=8791
set SNIPER_SKIP_LOGIN=1
set SNIPER_ALREADY_LOGGED_IN=1

echo.
echo Coletor em C:\SNIPERBO — NAO FECHE esta janela.
echo.

:LOOP
echo [%date% %time%] Ligando...
"%PY%" "%ROOT%\sniper_bo_scraper.py" --config "%ROOT%\config.json" --interval 0.5 --admin-api-enabled --no-telegram --log-file "%ROOT%\official_legacy_collector.log"
echo Reiniciando em 8s...
timeout /t 8 /nobreak >nul
goto LOOP
