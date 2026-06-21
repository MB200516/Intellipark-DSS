#!/bin/bash
# IntelliPark DSS — Start Script
# Starts both FastAPI backend and Next.js frontend

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║         INTELLIPARK DSS — Starting Up            ║"
echo "║   Parking Violation Intelligence Platform        ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 is required. Install from https://python.org"
    exit 1
fi

# Check Node
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is required. Install from https://nodejs.org"
    exit 1
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Backend setup ──────────────────────────────────────
echo "[1/4] Setting up Python environment..."
cd "$PROJECT_DIR/backend"

if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate
pip install -r requirements.txt --quiet

echo "[2/4] Starting FastAPI backend on http://localhost:8000 ..."
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "      Backend PID: $BACKEND_PID"

# ── Frontend setup ─────────────────────────────────────
echo "[3/4] Installing frontend dependencies..."
cd "$PROJECT_DIR/frontend"

if [ ! -d "node_modules" ]; then
    npm install --silent
fi

echo "[4/4] Starting Next.js frontend on http://localhost:3000 ..."
npm run dev &
FRONTEND_PID=$!
echo "      Frontend PID: $FRONTEND_PID"

echo ""
echo "──────────────────────────────────────────────────────"
echo "  IntelliPark DSS is running"
echo ""
echo "  Frontend:  http://localhost:3000"
echo "  Backend:   http://localhost:8000"
echo "  API Docs:  http://localhost:8000/docs"
echo ""
echo "  Credentials: admin / admin123"
echo "──────────────────────────────────────────────────────"
echo ""
echo "  Press Ctrl+C to stop all services"
echo ""

# Cleanup on exit
trap "echo ''; echo 'Stopping services...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

wait
