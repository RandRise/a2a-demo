@echo off
cd /d "%~dp0"
call npm run docs:dev -- --open
pause
