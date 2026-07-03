@echo off
chcp 65001 >nul
title SNIPERBO - Corrigir tela preta
cd /d "%~dp0"

set "CODEX=C:\Users\Usuario\OneDrive\Documentos\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior"
if not exist "%CODEX%\.venv\Scripts\python.exe" set "CODEX=%USERPROFILE%\OneDrive\Documentos\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior"
set "PY=%CODEX%\.venv\Scripts\python.exe"
if not exist "%PY%" set "PY=python"

echo Fechando Chrome/Edge antigos...
taskkill /F /IM msedge.exe 2>nul
taskkill /F /IM chrome.exe 2>nul
timeout /t 2 /nobreak >nul

"%PY%" scripts\patch_browser_black_screen.py "%CD%"
call "%~dp0AUTO_LOGIN_E_LIGAR.bat"
