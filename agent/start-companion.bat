@echo off
title Print Shop Local Agent - Desktop Companion
cd /d "%~dp0"

echo ========================================================
echo   Print Shop Local Agent - Desktop Companion Launcher
echo ========================================================
echo.

:: Check if node is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

:: If Electron is installed, launch native desktop window
if exist "node_modules\electron\dist\electron.exe" (
    echo Launching Native Desktop Companion Window...
    start "" "node_modules\electron\dist\electron.exe" .
    exit /b 0
)

:: Fallback: Start Node which boots the print engine and opens the companion GUI dashboard in your browser
echo Launching Print Shop Companion Dashboard...
start "" node index.js
exit /b 0
