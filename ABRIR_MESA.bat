@echo off
chcp 65001 >nul
title SNIPERBO - Abrir mesa Bac Bo
cd /d "%~dp0"

echo.
echo ================================================
echo   SNIPERBO - Abrindo mesa Bac Bo no Chrome
echo ================================================
echo.
echo   Aguarde... o Chrome vai abrir sozinho.
echo   NAO feche esta janela ate terminar.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\abrir_mesa.ps1"

echo.
echo Pressione qualquer tecla para fechar...
pause >nul
