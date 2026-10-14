@echo off
cd /d "%~dp0"
if not exist "node_modules\@a2a-js\sdk\package.json" (
  echo First run: open a terminal in this folder and run npm ci.
  pause
  exit /b 1
)
echo Open http://127.0.0.1:8780 after the server starts.
call npm start
pause
