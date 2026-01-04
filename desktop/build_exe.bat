@echo off
echo Building M-essenger EXE...
cd /d "%~dp0"

echo Installing dependencies...
call npm.cmd install

echo Building EXE...
call npm.cmd run build

if %ERRORLEVEL% NEQ 0 (
    echo Build failed!
    pause
    exit /b %ERRORLEVEL%
)

echo Build complete! You can find the exe in the 'dist' folder.
pause
