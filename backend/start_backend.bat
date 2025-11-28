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

echo [backend] starting uvicorn on 127.0.0.1:8001...
start "backend" cmd /k "cd /d %~dp0 && call .venv\Scripts\activate && uvicorn main:app --host 127.0.0.1 --port 8001"
endlocal
