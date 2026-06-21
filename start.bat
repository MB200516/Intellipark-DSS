@echo off
echo.
echo ============================================
echo   INTELLIPARK DSS - Starting Up
echo   Parking Violation Intelligence Platform
echo ============================================
echo.

SET PROJECT_DIR=%~dp0

echo [1/4] Setting up Python environment...
cd /d "%PROJECT_DIR%backend"

if not exist "venv" (
    python -m venv venv
)

call venv\Scripts\activate.bat
pip install -r requirements.txt --quiet

echo [2/4] Starting FastAPI backend on http://localhost:8000 ...
start /B uvicorn main:app --host 0.0.0.0 --port 8000 --reload

echo [3/4] Installing frontend dependencies...
cd /d "%PROJECT_DIR%frontend"

if not exist "node_modules" (
    npm install
)

echo [4/4] Starting Next.js frontend on http://localhost:3000 ...
start /B npm run dev

echo.
echo -----------------------------------------------
echo   IntelliPark DSS is running
echo.
echo   Frontend:  http://localhost:3000
echo   Backend:   http://localhost:8000
echo   API Docs:  http://localhost:8000/docs
echo.
echo   Login: admin / admin123
echo -----------------------------------------------
echo.
pause
