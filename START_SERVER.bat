@echo off
title M-essenger Server
cd /d "%~dp0server"
echo Starting M-essenger Server...
echo.
"C:\Program Files\nodejs\node.exe" index.js
pause
