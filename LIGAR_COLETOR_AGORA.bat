@echo off
chcp 65001 >nul
title SNIPERBO - Coletor
cd /d "%~dp0"
set "ROOT=%CD%"

set "CODEX=C:\Users\Usuario\OneDrive\Documentos\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior"
if not exist "%CODEX%\sniper_bo_scraper.py" set "CODEX=%USERPROFILE%\OneDrive\Documentos\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior"

set "PY="
if exist "%CODEX%\.venv\Scripts\python.exe" set "PY=%CODEX%\.venv\Scripts\python.exe"
if not defined PY if exist ".venv\Scripts\python.exe" set "PY=.venv\Scripts\python.exe"
if not defined PY set "PY=python"

set "SCRAPER=%ROOT%\sniper_bo_scraper.py"
set "WORKDIR=%ROOT%"
if exist "%CODEX%\sniper_bo_scraper.py" (
  set "SCRAPER=%CODEX%\sniper_bo_scraper.py"
  set "WORKDIR=%CODEX%"
)

echo.
echo Corrigindo banco + login...
"%PY%" "%ROOT%\scripts\fix_collector_config.py" "%ROOT%"
if errorlevel 1 (
  echo ERRO ao corrigir config.json
  pause
  exit /b 1
)

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
if defined COLLECTOR_LOGIN_EMAIL set SNIPER_LOGIN_EMAIL=%COLLECTOR_LOGIN_EMAIL%
if defined COLLECTOR_LOGIN_PASSWORD set SNIPER_LOGIN_PASSWORD=%COLLECTOR_LOGIN_PASSWORD%
if defined COLLECTOR_LOGIN_EMAIL set SITE_LOGIN_EMAIL=%COLLECTOR_LOGIN_EMAIL%
if defined COLLECTOR_LOGIN_PASSWORD set SITE_LOGIN_PASSWORD=%COLLECTOR_LOGIN_PASSWORD%
if defined COLLECTOR_LOGIN_EMAIL set CASINO_EMAIL=%COLLECTOR_LOGIN_EMAIL%
if defined COLLECTOR_LOGIN_PASSWORD set CASINO_PASSWORD=%COLLECTOR_LOGIN_PASSWORD%

echo.
echo Pasta do Chrome: %WORKDIR%
echo Coletor fica ABERTO. Se fechar, reinicia sozinho.
echo NAO FECHE esta janela.
echo.

cd /d "%WORKDIR%"
:LOOP
echo.
echo [%date% %time%] Ligando coletor...
"%PY%" "%SCRAPER%" --config "%ROOT%\config.json" --interval 0.5 --admin-api-enabled --no-telegram --log-file "%ROOT%\official_legacy_collector.log"
echo Coletor parou (codigo %ERRORLEVEL%). Reiniciando em 8 segundos...
timeout /t 8 /nobreak >nul
goto LOOP
