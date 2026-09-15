@echo off
setlocal
title Feul Station Pro
cd /d "%~dp0"

:: Start Node server in background if port 3000 is not listening
netstat -ano | findstr :3000 | findstr LISTENING >nul
if %errorlevel% neq 0 (
    start "" /b node server.js
    timeout /t 2 /nobreak >nul
)

:: Check if Electron is installed
if exist "node_modules\electron\dist\electron.exe" (
    start "" "node_modules\electron\dist\electron.exe" .
    exit /b
)

:: Fallback to Windows Edge Native App Window (Zero install needed!)
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="http://localhost:3000" --window-size=1280,850 --user-data-dir="%LOCALAPPDATA%\FeulStationApp"
    exit /b
)

if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app="http://localhost:3000" --window-size=1280,850 --user-data-dir="%LOCALAPPDATA%\FeulStationApp"
    exit /b
)

:: Fallback to Chrome Native App Window
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="http://localhost:3000" --window-size=1280,850 --user-data-dir="%LOCALAPPDATA%\FeulStationApp"
    exit /b
)

:: Ultimate fallback: default browser
start "" "http://localhost:3000"
exit /b
