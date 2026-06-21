from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from auth import current_user, current_officer, hash_pw, verify_pw, make_token
from data_store import PATROL_UNITS_DEFAULT
from ws_manager import manager
import database as db

router = APIRouter(tags=["officers"])

def _now():
    return datetime.now().isoformat()

@router.post("/officer/login")
async def officer_login(badge: str, password: str):
    conn = await db.get_db()
    try:
        cur = await conn.execute("SELECT * FROM officers WHERE badge = ?", (badge,))
        row = await cur.fetchone()
        if not row or row["password"] != hash_pw(password):
            raise HTTPException(400, "Incorrect badge or password")
        token = make_token({"sub": f"officer:{row['id']}"})
        return {
            "access_token": token, "token_type": "bearer",
            "officer": {"id": row["id"], "name": row["name"], "badge": row["badge"],
                        "unit_name": row["unit_name"], "status": row["status"]},
        }
    finally:
        await conn.close()

@router.post("/officer/location")
async def update_location(lat: float, lng: float, accuracy: float = 10.0,
                           officer_id: str = Depends(current_officer)):
    conn = await db.get_db()
    try:
        await conn.execute("""
            INSERT INTO officer_locations (officer_id, lat, lng, accuracy, timestamp)
            VALUES (?, ?, ?, ?, ?)
        """, (officer_id, lat, lng, accuracy, _now()))
        await conn.execute("UPDATE officers SET last_seen = ? WHERE id = ?", (_now(), officer_id))
        await conn.commit()
    finally:
        await conn.close()

    await manager.broadcast_to_dashboard({
        "type": "officer_location", "officer_id": officer_id,
        "lat": lat, "lng": lng, "timestamp": _now(),
    })
    return {"ok": True}

@router.get("/officers")
async def list_officers(_=Depends(current_user)):
    conn = await db.get_db()
    try:
        cur = await conn.execute("SELECT * FROM officers")
        rows = await cur.fetchall()
        result = []
        for r in rows:
            loc_cur = await conn.execute(
                "SELECT lat, lng, timestamp FROM officer_locations WHERE officer_id=? ORDER BY timestamp DESC LIMIT 1",
                (r["id"],))
            loc = await loc_cur.fetchone()
            result.append({
                "id": r["id"], "name": r["name"], "badge": r["badge"], "unit_name": r["unit_name"],
                "status": r["status"], "last_seen": r["last_seen"],
                "lat": loc["lat"] if loc else None, "lng": loc["lng"] if loc else None,
                "loc_timestamp": loc["timestamp"] if loc else None,
                "online": manager.is_officer_online(r["id"]),
            })
        return result
    finally:
        await conn.close()

@router.post("/officers/{officer_id}/release")
async def release_officer(officer_id: str, _=Depends(current_user)):
    # supervisor override: force officer to available, cancel their active assignments
    conn = await db.get_db()
    try:
        await conn.execute("UPDATE officers SET status='available' WHERE id=?", (officer_id,))
        await conn.execute("""
            UPDATE assignments SET status='cancelled'
            WHERE officer_id=? AND status IN ('pending','accepted','en_route','arrived')
        """, (officer_id,))
        await conn.commit()
        await manager.broadcast_to_dashboard({
            "type": "officer_status", "officer_id": officer_id, "status": "available",
        })
        return {"ok": True, "officer_id": officer_id, "status": "available"}
    finally:
        await conn.close()
