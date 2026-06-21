"""
WebSocket connection manager.

Two channels:
  /ws/dashboard         - supervisors watching live map + assignment status
  /ws/officer/{officer_id} - individual officer app connection

Message types (JSON):
  FROM officer app:
    {"type":"location_update", "lat":.., "lng":.., "accuracy":..}
    {"type":"status_change",   "status":"available|on_patrol|off_duty"}
    {"type":"assignment_response", "assignment_id":.., "action":"accept|decline"}
    {"type":"assignment_arrived",  "assignment_id":..}
    {"type":"assignment_completed","assignment_id":.., "notes":".."}

  FROM dashboard (admin actions broadcast to officer):
    {"type":"new_assignment", "assignment": {...}}

  Server broadcasts to dashboard on any change:
    {"type":"officer_location", "officer_id":.., "lat":.., "lng":..}
    {"type":"officer_status",   "officer_id":.., "status":..}
    {"type":"assignment_update","assignment": {...}}
"""

from fastapi import WebSocket
from typing import Dict, List
import json


class ConnectionManager:
    def __init__(self):
        self.dashboard_clients: List[WebSocket] = []
        self.officer_clients: Dict[str, WebSocket] = {}

    # ── Dashboard ──────────────────────────────────────────────────
    async def connect_dashboard(self, ws: WebSocket):
        await ws.accept()
        self.dashboard_clients.append(ws)

    def disconnect_dashboard(self, ws: WebSocket):
        if ws in self.dashboard_clients:
            self.dashboard_clients.remove(ws)

    async def broadcast_to_dashboard(self, message: dict):
        dead = []
        for ws in self.dashboard_clients:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect_dashboard(ws)

    # ── Officers ───────────────────────────────────────────────────
    async def connect_officer(self, officer_id: str, ws: WebSocket):
        await ws.accept()
        self.officer_clients[officer_id] = ws

    def disconnect_officer(self, officer_id: str):
        self.officer_clients.pop(officer_id, None)

    async def send_to_officer(self, officer_id: str, message: dict) -> bool:
        ws = self.officer_clients.get(officer_id)
        if not ws:
            return False
        try:
            await ws.send_text(json.dumps(message))
            return True
        except Exception:
            self.disconnect_officer(officer_id)
            return False

    def is_officer_online(self, officer_id: str) -> bool:
        return officer_id in self.officer_clients


manager = ConnectionManager()
