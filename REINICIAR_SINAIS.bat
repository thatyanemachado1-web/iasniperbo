@echo off
chcp 65001 >nul
title SNIPERBO - Reiniciar coletor e publisher
cd /d "%~dp0"

echo Reiniciando coletor e publisher para sniperbo.com...
echo.

for /f "tokens=2" %%P in ('wmic process where "commandline like '%%official_dashboard_publisher.py%%'" get processid /format:list 2^>nul ^| find "="') do taskkill /F /PID %%P 2>nul
for /f "tokens=2" %%P in ('wmic process where "commandline like '%%sniper_bo_scraper.py%%'" get processid /format:list 2^>nul ^| find "="') do taskkill /F /PID %%P 2>nul
for /f "tokens=2" %%P in ('wmic process where "commandline like '%%watch_sniperbo_official.ps1%%'" get processid /format:list 2^>nul ^| find "="') do taskkill /F /PID %%P 2>nul

timeout /t 2 /nobreak >nul

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\corrigir_para_super.ps1" -SkipOpenMesa
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\configurar_publisher_credenciais.ps1" -AdminEmail "gabrielmendespromove@gmail.com" -AdminPassword "AdminSniper2026!"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\ligar_sinais.ps1"

echo.
echo Abra DIAGNOSTICAR_SINAIS.bat para ver se coletor e publisher estao OK.
pause
