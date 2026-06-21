@echo off
REM NGenomeSyn Web Interface - Windows Start Script
REM Usage: start.bat [port]

cd /d "%~dp0web"
if errorlevel 1 (
  echo Error: web\ directory not found
  pause
  exit /b 1
)

set PORT=%1
if "%PORT%"=="" set PORT=1688

echo Starting NGenomeSyn Web Interface on port %PORT% ...
echo Open http://127.0.0.1:%PORT% in your browser
echo.

where gunicorn >nul 2>nul
if %ERRORLEVEL% equ 0 (
  echo [using gunicorn]
  gunicorn -w 4 -b 0.0.0.0:%PORT% app:app
) else (
  echo [using flask dev server - install gunicorn via: pip install gunicorn]
  python app.py %PORT%
)
pause
