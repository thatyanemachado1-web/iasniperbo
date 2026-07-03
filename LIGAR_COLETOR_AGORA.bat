@echo off
chcp 65001 >nul
title SNIPERBO - Coletor
cd /d "%~dp0"

set "PY="
if exist "C:\Users\Usuario\OneDrive\Documentos\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior\.venv\Scripts\python.exe" set "PY=C:\Users\Usuario\OneDrive\Documentos\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior\.venv\Scripts\python.exe"
if not defined PY if exist "%USERPROFILE%\OneDrive\Documentos\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior\.venv\Scripts\python.exe" set "PY=%USERPROFILE%\OneDrive\Documentos\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior\.venv\Scripts\python.exe"
if not defined PY if exist ".venv\Scripts\python.exe" set "PY=.venv\Scripts\python.exe"
if not defined PY set "PY=python"

echo.
echo Corrigindo banco + login...
"%PY%" scripts\fix_collector_config.py "%CD%"
if errorlevel 1 (
  echo ERRO ao corrigir config.json
  pause
  exit /b 1
)

for /f "usebackq tokens=1,* delims==" %%A in ("scripts\official_publisher.local.env") do (
  if "%%A"=="SNIPER_ADMIN_TOKEN" set "SNIPER_ADMIN_TOKEN=%%B"
  if "%%A"=="SNIPER_ADMIN_EMAIL" set "SNIPER_ADMIN_EMAIL=%%B"
  if "%%A"=="SNIPER_ADMIN_PASSWORD" set "SNIPER_ADMIN_PASSWORD=%%B"
)

if exist "collector_login.local.env" for /f "usebackq tokens=1,* delims==" %%A in ("collector_login.local.env") do (
  if "%%A"=="COLLECTOR_LOGIN_EMAIL" set "COLLECTOR_LOGIN_EMAIL=%%B"
  if "%%A"=="COLLECTOR_LOGIN_PASSWORD" set "COLLECTOR_LOGIN_PASSWORD=%%B"
)

set SNIPER_ADMIN_API_ENABLED=1
set SNIPER_ADMIN_API_HOST=127.0.0.1
set SNIPER_ADMIN_API_PORT=8791
if defined COLLECTOR_LOGIN_EMAIL set SNIPER_LOGIN_EMAIL=%COLLECTOR_LOGIN_EMAIL%
if defined COLLECTOR_LOGIN_PASSWORD set SNIPER_LOGIN_PASSWORD=%COLLECTOR_LOGIN_PASSWORD%
if defined COLLECTOR_LOGIN_EMAIL set SITE_LOGIN_EMAIL=%COLLECTOR_LOGIN_EMAIL%
if defined COLLECTOR_LOGIN_PASSWORD set SITE_LOGIN_PASSWORD=%COLLECTOR_LOGIN_PASSWORD%
if defined COLLECTOR_LOGIN_EMAIL set CASINO_EMAIL=%COLLECTOR_LOGIN_EMAIL%
if defined COLLECTOR_LOGIN_PASSWORD set CASINO_PASSWORD=%COLLECTOR_LOGIN_PASSWORD%

echo.
echo Abrindo coletor + Chrome...
echo NAO FECHE esta janela.
echo.

"%PY%" sniper_bo_scraper.py --config config.json --interval 0.5 --admin-api-enabled --no-telegram --log-file official_legacy_collector.log
echo.
echo Coletor encerrou. Codigo: %ERRORLEVEL%
pause
