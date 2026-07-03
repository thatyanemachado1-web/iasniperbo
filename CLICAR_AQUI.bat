@echo off
cd /d "%~dp0"
if not exist "%~dp0scripts\official_dashboard_publisher.py" (
  echo.
  echo Faltam arquivos. Iniciando instalador automatico...
  echo.
  call "%~dp0INSTALAR_TUDO.bat"
  exit /b %ERRORLEVEL%
)
call "%~dp0LIGAR_SINAIS.bat"
