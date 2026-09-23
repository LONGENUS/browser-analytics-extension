@echo off
title WebIntel Backend Server
color 0A
echo ===================================================
echo   Starting WebIntel Backend Server (FastAPI + Crawl4AI)
echo   Local URL: http://localhost:8000
echo   Docs:      http://localhost:8000/docs
echo ===================================================
echo.

cd /d "%~dp0backend"

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Please install Python 3.11+ and try again.
    pause
    exit /b 1
)

REM Start the application
python app.py

pause
