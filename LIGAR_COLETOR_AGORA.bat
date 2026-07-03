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
echo Corrigindo banco de dados...
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

set SNIPER_ADMIN_API_ENABLED=1
set SNIPER_ADMIN_API_HOST=127.0.0.1
set SNIPER_ADMIN_API_PORT=8791

echo.
echo Abrindo coletor + Chrome...
echo NAO FECHE esta janela.
echo.

"%PY%" sniper_bo_scraper.py --config config.json --interval 0.5 --admin-api-enabled --no-telegram --log-file official_legacy_collector.log
echo.
echo Coletor encerrou. Codigo: %ERRORLEVEL%
pause
