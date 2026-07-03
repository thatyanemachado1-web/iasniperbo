@echo off
chcp 65001 >nul
title SNIPERBO - Auto Login + Coletor
cd /d "%~dp0"
set "ROOT=%CD%"

(
echo COLLECTOR_LOGIN_EMAIL=gabrielmendespromove@gmail.com
echo COLLECTOR_LOGIN_PASSWORD=221600Pmcg11
) > collector_login.local.env

set "CODEX=C:\Users\Usuario\OneDrive\Documentos\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior"
if not exist "%CODEX%\.venv\Scripts\python.exe" set "CODEX=%USERPROFILE%\OneDrive\Documentos\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior"
set "PY=%CODEX%\.venv\Scripts\python.exe"
if not exist "%PY%" set "PY=python"

"%PY%" "%ROOT%\scripts\fix_collector_config.py" "%ROOT%"
"%PY%" "%ROOT%\scripts\patch_77super_login.py" "%ROOT%"
"%PY%" "%ROOT%\scripts\patch_browser_black_screen.py" "%ROOT%"
"%PY%" "%ROOT%\scripts\auto_login_77super.py" "%ROOT%"
if errorlevel 1 (
  echo ERRO no login automatico
  pause
  exit /b 1
)

start "SNIPERBO Publisher" cmd /k "cd /d %ROOT% && powershell -NoProfile -ExecutionPolicy Bypass -File scripts\iniciar_publisher_windows.ps1"
call "%ROOT%\LIGAR_COLETOR_AGORA.bat"
