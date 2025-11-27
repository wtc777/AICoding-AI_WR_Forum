@echo off
setlocal
cd /d %~dp0

REM Backend standalone launcher
if not exist .venv\Scripts\activate.bat (
  echo [backend] creating venv...
  python -m venv .venv || (echo [backend] venv creation failed & pause & exit /b 1)
)

echo [backend] installing deps...
call .venv\Scripts\python -m pip install -r requirements.txt

echo [backend] starting uvicorn...
start "backend" cmd /k "cd /d %~dp0 && call .venv\Scripts\activate && uvicorn main:app --reload"
endlocal
