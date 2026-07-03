@echo off
chcp 65001 >nul
title SNIPERBO - Abrir mesa Bac Bo
cd /d "%~dp0"

echo.
echo ================================================
echo   SNIPERBO - Abrindo mesa Bac Bo (Casa Super)
echo ================================================
echo.
echo   Aguarde 30 a 60 segundos. NAO feche esta janela.
echo.

if not exist "%~dp0scripts" mkdir "%~dp0scripts"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$u='https://raw.githubusercontent.com/thatyanemachado1-web/iasniperbo/cursor/corrigir-agora-bat-f115/scripts/abrir_mesa.ps1';" ^
  "$f='%~dp0scripts\abrir_mesa.ps1';" ^
  "try { Invoke-WebRequest -Uri $u -OutFile $f -UseBasicParsing } catch { Write-Host 'Sem internet - usando script local.' };" ^
  "& $f"

echo.
pause
