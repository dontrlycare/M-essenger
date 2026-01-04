@echo off
cd /d "%~dp0"
set PATH=%PATH%;C:\Program Files\nodejs
call node_modules\.bin\electron.cmd .
