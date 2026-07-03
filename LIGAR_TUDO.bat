@echo off
chcp 65001 >nul
title SNIPERBO
cd /d "C:\SNIPERBO"
set "ROOT=C:\SNIPERBO"

if exist "%ROOT%\.venv\Scripts\python.exe" (
  set "PY=%ROOT%\.venv\Scripts\python.exe"
) else (
  call "%ROOT%\PREPARAR_PC.bat"
  set "PY=%ROOT%\.venv\Scripts\python.exe"
)

echo.
echo === SNIPERBO - C:\SNIPERBO ===
echo.

if not exist "%ROOT%\sniper_bo_scraper.py" (
  echo ERRO: coloque sniper_bo_scraper.py em C:\SNIPERBO
  pause
  exit /b 1
)

taskkill /F /IM msedge.exe 2>nul
for /f "tokens=2" %%P in ('wmic process where "commandline like '%%sniper_bo_scraper.py%%'" get processid /format:list 2^>nul ^| find "="') do taskkill /F /PID %%P 2>nul
timeout /t 2 /nobreak >nul

echo [1/4] Verificando coletor...
"%PY%" "%ROOT%\scripts\restaurar_scraper.py" "%ROOT%"
if errorlevel 1 goto :FALHOU

(
echo COLLECTOR_LOGIN_EMAIL=gabrielmendespromove@gmail.com
echo COLLECTOR_LOGIN_PASSWORD=221600Pmcg11
) > "%ROOT%\collector_login.local.env"

echo [2/4] Login automatico...
set PYTHONPATH=%ROOT%\scripts
"%PY%" "%ROOT%\scripts\fix_collector_config.py" "%ROOT%"
"%PY%" "%ROOT%\scripts\auto_login_77super.py" "%ROOT%"
if errorlevel 1 goto :FALHOU

echo [3/4] Publisher...
start "Publisher" /MIN cmd /c "cd /d C:\SNIPERBO && powershell -NoProfile -ExecutionPolicy Bypass -File scripts\configurar_publisher_credenciais.ps1 -AdminEmail gabrielmendespromove@gmail.com -AdminPassword AdminSniper2026! -LocalDashboardUrl http://127.0.0.1:8791/dashboard && powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start_official_publisher.ps1"

echo [4/4] Coletor...
call "%ROOT%\LIGAR_COLETOR_AGORA.bat"
goto :FIM

:FALHOU
echo.
echo FALHOU. Verifique C:\SNIPERBO\sniper_bo_scraper.py
pause
exit /b 1

:FIM
