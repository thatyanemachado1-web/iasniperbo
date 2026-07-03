@echo off
chcp 65001 >nul
title SNIPERBO - Preparar PC
cd /d "C:\SNIPERBO"

echo [1/3] Python venv em C:\SNIPERBO...
if not exist ".venv\Scripts\python.exe" (
  python -m venv .venv
)
set "PY=.venv\Scripts\python.exe"

echo [2/3] Instalando bibliotecas...
"%PY%" -m pip install -q --upgrade pip
"%PY%" -m pip install -q requests truststore playwright

echo [3/3] Instalando Chrome Playwright...
"%PY%" -m playwright install chromium

echo.
echo PRONTO. Pasta: C:\SNIPERBO
pause
