# IntelliPark Officer App

React Native (Expo) mobile app for patrol officers. Connects to the
IntelliPark DSS backend over REST + WebSocket for real-time location
tracking and assignment coordination.

## Setup

```bash
cd officer-app
npm install
npx expo start
```

Scan the QR code with the Expo Go app (Android/iOS), or press `a` for
an Android emulator / `i` for iOS simulator.

## IMPORTANT — Network configuration

Edit `src/lib/api.js` and set `API_BASE` / `WS_BASE` to point at your
backend:

- **Android emulator:** `http://10.0.2.2:8000` (already set, this is
  the emulator's alias for your machine's localhost)
- **Physical phone on same WiFi:** use your computer's LAN IP, e.g.
  `http://192.168.1.42:8000` — find it with `ipconfig` (Windows) or
  `ifconfig` (Mac/Linux)
- **iOS simulator:** `http://localhost:8000` works directly

```js
export const API_BASE = 'http://192.168.1.42:8000';
export const WS_BASE   = 'ws://192.168.1.42:8000';
```

## Demo login

| Badge   | Password    | Unit          |
|---------|-------------|---------------|
| BTP-A1  | officer123  | Unit Alpha-1  |
| BTP-A2  | officer123  | Unit Alpha-2  |
| BTP-B1  | officer123  | Unit Bravo-1  |
| BTP-B2  | officer123  | Unit Bravo-2  |
| BTP-C1  | officer123  | Unit Charlie-1|

## How it works

1. On login, the app opens a WebSocket to `/ws/officer/{officer_id}`.
2. Every ~12 seconds (or 25m of movement) it sends its GPS location.
   This is broadcast to all connected dashboards in real time.
3. When a supervisor clicks "Assign Nearest Unit" on the dashboard,
   the backend runs Bidirectional A* over the road graph from every
   available officer's current location to the hotspot, picks the
   closest one, and pushes a `new_assignment` message directly to
   that officer's open WebSocket connection.
4. The officer sees a full-screen modal with the location, distance,
   and ETA, and can Accept or Decline.
5. Accepting flips their status to "On Patrol" — visible instantly
   on the dashboard's Officer Roster panel.
6. On arrival they tap "Mark Arrived", then "Complete Patrol" when done,
   which returns their status to "Available" for the next assignment.
