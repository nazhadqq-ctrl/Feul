@echo off
setlocal
chcp 65001 >nul
title دابەزاندن و دامەزراندنی سیستەمی بەنزینخانە
cd /d "%~dp0"

echo ========================================================
echo   سیستەمی تۆمارکردنی بەنزینخانە - Feul Station Pro
echo   دامەزراندنی بەرنامە و دروستکردنی ئایکۆنی دیسکتۆپ
echo ========================================================
echo.

:: 1. Verify Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] ئاگاداری: Node.js لەسەر ئەم کۆمپیوتەرە نەدۆزرایەوە!
    echo تکایە Node.js لە ماڵپەڕی https://nodejs.org دابمەزرێنە.
    echo.
    pause
    exit /b 1
)

echo [*] پشکنینی پاکێج و پەیوەندییەکان (Dependencies)...
call npm install --omit=dev >nul 2>nul

echo [*] دروستکردنی ئایکۆن و کورتەبڕی دیسکتۆپ (Desktop Shortcut)...
powershell -ExecutionPolicy Bypass -File .\convert-ico.ps1 >nul 2>nul
powershell -ExecutionPolicy Bypass -File .\Setup-Desktop-Shortcut.ps1

echo.
echo ========================================================
echo   [✓] بە سەرکەوتوویی لەسەر دیسکتۆپ دامەزرا!
echo   ئێستا دەتوانیت لەسەر دیسکتۆپ کلیک لەسەر ئایکۆنی
echo   (Feul Station Pro) بکەیت بۆ دەستپێکردن.
echo ========================================================
echo.
pause
