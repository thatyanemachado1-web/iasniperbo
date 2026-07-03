@echo off
chcp 65001 >nul
title SNIPERBO - Corrigir Playwright
cd /d "%~dp0"

set "PY=C:\Users\Usuario\OneDrive\Documentos\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior\.venv\Scripts\python.exe"
if not exist "%PY%" set "PY=%USERPROFILE%\OneDrive\Documentos\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior\.venv\Scripts\python.exe"
if not exist "%PY%" set "PY=python"

echo.
echo [1/3] Fechando Chrome/Playwright antigos...
taskkill /F /IM chrome.exe 2>nul
taskkill /F /IM msedge.exe 2>nul
for /f "tokens=2" %%P in ('wmic process where "commandline like '%%sniper_bo_scraper.py%%'" get processid /format:list 2^>nul ^| find "="') do taskkill /F /PID %%P 2>nul
timeout /t 2 /nobreak >nul

echo [2/3] Instalando Chrome do Playwright (pode demorar)...
"%PY%" -m playwright install chromium
if errorlevel 1 (
  echo ERRO no playwright install
  pause
  exit /b 1
)

echo [3/3] Ligando coletor com login...
call "%~dp0LOGIN_E_LIGAR.bat"
