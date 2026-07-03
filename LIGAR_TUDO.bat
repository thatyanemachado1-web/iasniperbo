@echo off
chcp 65001 >nul
title SNIPERBO
cd /d "C:\SNIPERBO"
set "ROOT=C:\SNIPERBO"

echo.
echo === SNIPERBO - C:\SNIPERBO ===
echo.

if not exist "%ROOT%\sniper_bo_scraper.py" (
  echo ERRO: falta C:\SNIPERBO\sniper_bo_scraper.py
  pause
  exit /b 1
)

echo [0/4] Preparando Python em C:\SNIPERBO...
where python >nul 2>&1
if errorlevel 1 (
  echo ERRO: instale Python de python.org
  pause
  exit /b 1
)
if not exist "%ROOT%\.venv\Scripts\python.exe" (
  python -m venv "%ROOT%\.venv"
)
set "PY=%ROOT%\.venv\Scripts\python.exe"
"%PY%" -m pip install -q --upgrade pip
"%PY%" -m pip install -q requests truststore playwright
"%PY%" -m playwright install chromium 2>nul

taskkill /F /IM msedge.exe 2>nul
for /f "tokens=2" %%P in ('wmic process where "commandline like '%%sniper_bo_scraper.py%%'" get processid /format:list 2^>nul ^| find "="') do taskkill /F /PID %%P 2>nul
timeout /t 2 /nobreak >nul

echo [1/4] Reparando coletor...
"%PY%" "%ROOT%\scripts\reparar_scraper.py" "%ROOT%"
"%PY%" "%ROOT%\scripts\restaurar_scraper.py" "%ROOT%"
if errorlevel 1 (
  echo.
  echo ERRO: sniper_bo_scraper.py quebrado.
  echo Copie o arquivo original de novo para C:\SNIPERBO\
  pause
  exit /b 1
)

(
echo COLLECTOR_LOGIN_EMAIL=gabrielmendespromove@gmail.com
echo COLLECTOR_LOGIN_PASSWORD=221600Pmcg11
) > "%ROOT%\collector_login.local.env"

echo [2/4] Login automatico...
set PYTHONPATH=%ROOT%\scripts
"%PY%" "%ROOT%\scripts\fix_collector_config.py" "%ROOT%"
"%PY%" "%ROOT%\scripts\auto_login_77super.py" "%ROOT%"
if errorlevel 1 (
  echo ERRO no login automatico
  pause
  exit /b 1
)

echo [3/4] Publisher...
start "Publisher" /MIN cmd /c "cd /d C:\SNIPERBO && powershell -NoProfile -ExecutionPolicy Bypass -File scripts\configurar_publisher_credenciais.ps1 -AdminEmail gabrielmendespromove@gmail.com -AdminPassword AdminSniper2026! -LocalDashboardUrl http://127.0.0.1:8791/dashboard && powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start_official_publisher.ps1"

echo [4/4] Coletor...
call "%ROOT%\LIGAR_COLETOR_AGORA.bat"
