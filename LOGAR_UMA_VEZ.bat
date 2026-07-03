@echo off
chcp 65001 >nul
title SNIPERBO - Login 1 vez
cd /d "%~dp0"

set "CODEX=C:\Users\Usuario\OneDrive\Documentos\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior"
if not exist "%CODEX%\.venv\Scripts\python.exe" set "CODEX=%USERPROFILE%\OneDrive\Documentos\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior"
set "PY=%CODEX%\.venv\Scripts\python.exe"
if not exist "%PY%" set "PY=python"

(
echo COLLECTOR_LOGIN_EMAIL=gabrielmendespromove@gmail.com
echo COLLECTOR_LOGIN_PASSWORD=221600Pmcg11
) > collector_login.local.env

"%PY%" scripts\fix_collector_config.py "%CD%"
"%PY%" scripts\patch_77super_login.py "%CD%"
"%PY%" scripts\abrir_login_manual.py "%CD%"
pause
