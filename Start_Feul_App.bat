@echo off
chcp 65001 > nul
title سیستەمی تۆمارکردنی بەنزینخانە - Feul Station Pro
color 0b

echo ===================================================================
echo     سیستەمی تۆمارکردنی بەنزینخانە - Feul Station Pro
echo     دەستپێکردنی سێرڤەر و پەیوەستبوون بە SQL Server...
echo ===================================================================
echo.

cd /d "%~dp0"

echo [1/2] کردنەوەی وێب ئەپ لە بڕاوسەر...
timeout /t 2 > nul
start http://localhost:3000

echo [2/2] کارپێکردنی سێرڤەری Node.js...
node server.js

pause
