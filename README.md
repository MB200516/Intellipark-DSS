# INTELLIPARK DSS
### Parking Violation Intelligence & Enforcement Command Platform
**Bengaluru Traffic Police — Hackathon MVP**

---

## Overview

IntelliPark DSS is a full-stack decision support system that detects parking violation hotspots, predicts future hotspots using ML (85.72% accuracy), quantifies risk, and helps supervisors prioritise enforcement.

```
Historical Violations → Hotspot Prediction → Risk Scoring → Enforcement Prioritisation → Patrol Assignment
```

---

## Quick Start

### Prerequisites

- Python 3.9+
- Node.js 18+

### Run (Mac / Linux)

```bash
chmod +x start.sh
./start.sh
```

### Run (Windows)

```
Double-click start.bat
```

### Manual Start

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Open: http://localhost:3000
Login: `admin` / `admin123`

---

## Tech Stack

| Layer      | Technology                      |
|------------|---------------------------------|
| Frontend   | Next.js 14, TypeScript, Tailwind CSS |
| Maps       | React Leaflet, OpenStreetMap    |
| Charts     | Recharts                        |
| Backend    | FastAPI (Python)                |
| Auth       | JWT                             |
| Distance   | Haversine formula               |

---

## Features

| Page                  | Path                       | Purpose                              |
|-----------------------|----------------------------|--------------------------------------|
| Login                 | `/login`                   | Officer authentication               |
| Command Overview      | `/dashboard`               | KPI cards, summary table, risk chart |
| Hotspot Prediction    | `/dashboard/hotspots`      | All predicted hotspots with risk     |
| Heatmap               | `/dashboard/heatmap`       | Spatial map of Bengaluru hotspots    |
| Enforcement Ranking   | `/dashboard/enforcement`   | Priority-ordered enforcement list    |
| Patrol Assignments    | `/dashboard/patrol`        | Nearest-unit recommendations         |

---

## Risk Score Formula

```
Risk Score = 40% Predicted Violations
           + 30% Historical Density
           + 20% Severity
           + 10% Growth Trend
           → Normalised 0–100
```

| Score  | Level    | Priority  |
|--------|----------|-----------|
| 80–100 | Critical | Immediate |
| 60–79  | High     | Urgent    |
| 40–59  | Moderate | Scheduled |
| 0–39   | Low      | Routine   |

---

## API Endpoints

| Method | Endpoint                   | Description               |
|--------|----------------------------|---------------------------|
| POST   | `/auth/login`              | Authenticate officer      |
| GET    | `/dashboard/kpi`           | KPI summary               |
| GET    | `/dashboard/summary`       | Top hotspot summary        |
| GET    | `/dashboard/risk-distribution` | Risk distribution chart |
| GET    | `/hotspots`                | All predicted hotspots    |
| GET    | `/enforcement/ranking`     | Ranked enforcement list   |
| GET    | `/patrol/recommendations`  | Patrol unit assignments   |
| GET    | `/health`                  | System health check       |

Swagger UI: http://localhost:8000/docs

---

## Design

- **Palette:** Crimson `#8B1E2D`, Dark Crimson `#5E141E`, Cool Grey `#5F6770`, Off White `#F5F3EE`
- **Typography:** Times New Roman throughout
- **Layout:** Sharp rectangles, no rounded corners, police command center aesthetic
- **Loading screen:** Fluid morphing shape, liquid flow lines, crimson drip animation, scan line — 3-second sequence

---

*Built for Bengaluru Traffic Police hackathon. Demo credentials: admin / admin123.*

---

## Officer Field App

A companion React Native (Expo) app lives in `officer-app/`. Patrol
officers log in, share live GPS location over WebSocket, and receive
real-time assignment pushes when a supervisor assigns them to a
hotspot from the dashboard.

```bash
cd officer-app
npm install
npx expo start
```

See `officer-app/README.md` for full network setup (you must point the
app at your backend's LAN IP if testing on a physical phone).

### How dashboard and officer app coordinate

1. Officer app opens a WebSocket to `/ws/officer/{officer_id}` on login
   and streams GPS updates every ~12 seconds.
2. Dashboard opens a WebSocket to `/ws/dashboard` and receives those
   location updates live, shown in the Officer Roster on the Patrol
   Assignments page.
3. Clicking "Assign Nearest Unit" calls `POST /assignments/create`,
   which runs Bidirectional A* (see `backend/routing.py`) from every
   available officer's last known location to the hotspot, picks the
   shortest road-distance route, and pushes the assignment directly
   to that officer's phone over their WebSocket connection.
4. The officer accepts or declines in the app. Accepting updates their
   status to "On Patrol" everywhere, including the dashboard, in
   real time.
5. All assignment data is stored in SQLite (`backend/data/intellipark.db`)
   with a full audit trail in `assignment_log`.

## Connecting Your Trained Model

Place your raw violation CSV at `backend/data/violations.csv`. On
startup the backend runs the full pipeline extracted from your
notebook (`backend/model_engine.py`) — feature engineering, LightGBM
training, 14-day forward prediction, and PCII risk scoring — and
serves real predictions instead of demo data. Check `/health` to
confirm `"using_real_data": true`.
