from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from datetime import datetime
from ws_manager import manager
import database as db
import json

router = APIRouter(tags=["websockets"])

def _now():
    return datetime.now().isoformat()

@router.websocket("/ws/dashboard")
async def ws_dashboard(websocket: WebSocket):
    await manager.connect_dashboard(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_dashboard(websocket)

@router.websocket("/ws/officer/{officer_id}")
async def ws_officer(websocket: WebSocket, officer_id: str):
    await manager.connect_officer(officer_id, websocket)
    conn = await db.get_db()
    try:
        await conn.execute("UPDATE officers SET status='available' WHERE id=? AND status='off_duty'", (officer_id,))
        await conn.commit()

        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            mtype = msg.get("type")

            if mtype == "location_update":
                lat, lng = msg["lat"], msg["lng"]
                await conn.execute("""
                    INSERT INTO officer_locations (officer_id, lat, lng, accuracy, timestamp)
                    VALUES (?, ?, ?, ?, ?)
                """, (officer_id, lat, lng, msg.get("accuracy", 10), _now()))
                await conn.execute("UPDATE officers SET last_seen=? WHERE id=?", (_now(), officer_id))
                await conn.commit()
                await manager.broadcast_to_dashboard({
                    "type": "officer_location", "officer_id": officer_id,
                    "lat": lat, "lng": lng, "timestamp": _now(),
                })

            elif mtype == "status_change":
                new_status = msg["status"]
                await conn.execute("UPDATE officers SET status=? WHERE id=?", (new_status, officer_id))
                await conn.commit()
                await manager.broadcast_to_dashboard({
                    "type": "officer_status", "officer_id": officer_id, "status": new_status,
                })

    except WebSocketDisconnect:
        manager.disconnect_officer(officer_id)
        await conn.execute("UPDATE officers SET status='off_duty' WHERE id=?", (officer_id,))
        await conn.commit()
        await manager.broadcast_to_dashboard({
            "type": "officer_status", "officer_id": officer_id, "status": "off_duty",
        })
    finally:
        await conn.close()
