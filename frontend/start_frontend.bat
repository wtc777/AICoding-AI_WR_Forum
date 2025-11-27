@echo off
setlocal
cd /d %~dp0

REM Frontend standalone launcher
if not exist node_modules (
  echo [frontend] installing npm deps...
  npm install || (echo [frontend] npm install failed & pause & exit /b 1)
)

echo [frontend] starting vite dev server...
start "frontend" cmd /k "cd /d %~dp0 && npm run dev"
endlocal
