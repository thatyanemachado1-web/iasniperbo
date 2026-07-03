@echo off
chcp 65001 >nul
title SNIPERBO - Restaurar e Ligar
cd /d "%~dp0"
set "ROOT=%CD%"

set "CODEX=C:\Users\Usuario\OneDrive\Documentos\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior"
if not exist "%CODEX%\.venv\Scripts\python.exe" set "CODEX=%USERPROFILE%\OneDrive\Documentos\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior"
set "PY=%CODEX%\.venv\Scripts\python.exe"
if not exist "%PY%" set "PY=python"

echo Fechando processos antigos...
taskkill /F /IM msedge.exe 2>nul
for /f "tokens=2" %%P in ('wmic process where "commandline like '%%sniper_bo_scraper.py%%'" get processid /format:list 2^>nul ^| find "="') do taskkill /F /PID %%P 2>nul
timeout /t 2 /nobreak >nul

echo Restaurando sniper_bo_scraper.py...
"%PY%" "%ROOT%\scripts\restaurar_scraper.py" "%ROOT%"
if errorlevel 1 (
  echo.
  echo Nao achou copia boa. Restaure pelo OneDrive:
  echo Botao direito em sniper_bo_scraper.py ^> Historico de versoes
  pause
  exit /b 1
)

(
echo COLLECTOR_LOGIN_EMAIL=gabrielmendespromove@gmail.com
echo COLLECTOR_LOGIN_PASSWORD=221600Pmcg11
) > collector_login.local.env

"%PY%" "%ROOT%\scripts\fix_collector_config.py" "%ROOT%"
"%PY%" "%ROOT%\scripts\auto_login_77super.py" "%ROOT%"

start "SNIPERBO Publisher" cmd /k "cd /d %ROOT% && powershell -NoProfile -ExecutionPolicy Bypass -File %ROOT%\scripts\configurar_publisher_credenciais.ps1 -AdminEmail gabrielmendespromove@gmail.com -AdminPassword AdminSniper2026! -LocalDashboardUrl http://127.0.0.1:8791/dashboard && powershell -NoProfile -ExecutionPolicy Bypass -File %ROOT%\scripts\start_official_publisher.ps1"

call "%ROOT%\LIGAR_COLETOR_AGORA.bat"
