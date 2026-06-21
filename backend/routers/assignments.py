from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from auth import current_user, current_officer
from data_store import store, PATROL_UNITS_DEFAULT
from routing import find_best_unit, bidirectional_astar
from ws_manager import manager
import database as db

router = APIRouter(tags=["assignments"])

def _now():
    return datetime.now().isoformat()

@router.post("/assignments/create")
async def create_assignment(hotspot_id: int, _=Depends(current_user)):
    hotspot = next((h for h in store.hotspots if h["id"] == hotspot_id), None)
    if not hotspot:
        raise HTTPException(404, "Hotspot not found")

    conn = await db.get_db()
    try:
        cur = await conn.execute("SELECT * FROM officers")
        officer_rows = await cur.fetchall()

        officers = []
        for r in officer_rows:
            loc_cur = await conn.execute(
                "SELECT lat, lng FROM officer_locations WHERE officer_id=? ORDER BY timestamp DESC LIMIT 1",
                (r["id"],))
            loc = await loc_cur.fetchone()
            officers.append({
                "id": r["id"], "name": r["name"], "unit_name": r["unit_name"],
                "status": r["status"],
                "lat": loc["lat"] if loc else PATROL_UNITS_DEFAULT.get(r["id"], {}).get("lat"),
                "lng": loc["lng"] if loc else PATROL_UNITS_DEFAULT.get(r["id"], {}).get("lng"),
            })

        active_cur = await conn.execute(
            "SELECT officer_id FROM assignments WHERE status IN ('pending','accepted','en_route','arrived')")
        active_rows = await active_cur.fetchall()
        deployed_ids = {row["officer_id"] for row in active_rows}

        best = find_best_unit(hotspot["lat"], hotspot["lng"], officers, deployed_ids)
        if not best:
            raise HTTPException(409, "No available units")

        cur = await conn.execute("""
            INSERT INTO assignments
            (hotspot_id, junction, lat, lng, risk_level, risk_score,
             officer_id, officer_name, unit_name, road_distance_km, eta_minutes,
             status, assigned_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
        """, (hotspot["id"], hotspot["junction"], hotspot["lat"], hotspot["lng"],
              hotspot["risk_level"], hotspot["risk_score"],
              best["id"], best["name"], best["unit_name"],
              best["road_distance_km"], best["eta_minutes"], _now()))
        assignment_id = cur.lastrowid

        await conn.execute("UPDATE officers SET status='dispatched' WHERE id=?", (best["id"],))
        await conn.execute("""
            INSERT INTO assignment_log (assignment_id, officer_id, from_status, to_status, timestamp, note)
            VALUES (?, ?, NULL, 'pending', ?, 'Assigned via Bidirectional A*')
        """, (assignment_id, best["id"], _now()))
        await conn.commit()

        assignment_payload = {
            "id": assignment_id, "hotspot_id": hotspot["id"], "junction": hotspot["junction"],
            "lat": hotspot["lat"], "lng": hotspot["lng"],
            "risk_level": hotspot["risk_level"], "risk_score": hotspot["risk_score"],
            "officer_id": best["id"], "officer_name": best["name"], "unit_name": best["unit_name"],
            "road_distance_km": best["road_distance_km"], "eta_minutes": best["eta_minutes"],
            "status": "pending",
        }

        pushed = await manager.send_to_officer(best["id"], {"type": "new_assignment", "assignment": assignment_payload})
        await manager.broadcast_to_dashboard({"type": "assignment_update", "assignment": assignment_payload, "pushed_to_app": pushed})

        return {**assignment_payload, "pushed_to_app": pushed}
    finally:
        await conn.close()

@router.get("/assignments")
async def list_assignments(_=Depends(current_user)):
    conn = await db.get_db()
    try:
        cur = await conn.execute("SELECT * FROM assignments ORDER BY assigned_at DESC LIMIT 50")
        rows = await cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        await conn.close()

@router.post("/assignments/{assignment_id}/respond")
async def respond_assignment(assignment_id: int, action: str, officer_id: str = Depends(current_officer)):
    if action not in ("accept", "decline"):
        raise HTTPException(400, "action must be accept or decline")

    conn = await db.get_db()
    try:
        cur = await conn.execute("SELECT * FROM assignments WHERE id=?", (assignment_id,))
        a = await cur.fetchone()
        if not a or a["officer_id"] != officer_id:
            raise HTTPException(404, "Assignment not found")

        new_status = "accepted" if action == "accept" else "declined"
        officer_status = "on_patrol" if action == "accept" else "available"

        await conn.execute("UPDATE assignments SET status=?, accepted_at=? WHERE id=?",
                            (new_status, _now() if action == "accept" else None, assignment_id))
        await conn.execute("UPDATE officers SET status=? WHERE id=?", (officer_status, officer_id))
        await conn.execute("""
            INSERT INTO assignment_log (assignment_id, officer_id, from_status, to_status, timestamp)
            VALUES (?, ?, 'pending', ?, ?)
        """, (assignment_id, officer_id, new_status, _now()))
        await conn.commit()

        await manager.broadcast_to_dashboard({"type": "assignment_update",
            "assignment": {"id": assignment_id, "status": new_status, "officer_id": officer_id}})
        return {"ok": True, "status": new_status}
    finally:
        await conn.close()

@router.post("/assignments/{assignment_id}/arrived")
async def mark_arrived(assignment_id: int, officer_id: str = Depends(current_officer)):
    conn = await db.get_db()
    try:
        await conn.execute("UPDATE assignments SET status='arrived', arrived_at=? WHERE id=? AND officer_id=?",
                            (_now(), assignment_id, officer_id))
        await conn.commit()
        await manager.broadcast_to_dashboard({"type": "assignment_update",
            "assignment": {"id": assignment_id, "status": "arrived", "officer_id": officer_id}})
        return {"ok": True}
    finally:
        await conn.close()

@router.post("/assignments/{assignment_id}/complete")
async def complete_assignment(assignment_id: int, notes: str = "", officer_id: str = Depends(current_officer)):
    conn = await db.get_db()
    try:
        await conn.execute("""
            UPDATE assignments SET status='completed', completed_at=?, notes=?
            WHERE id=? AND officer_id=?
        """, (_now(), notes, assignment_id, officer_id))
        await conn.execute("UPDATE officers SET status='available' WHERE id=?", (officer_id,))
        await conn.commit()
        await manager.broadcast_to_dashboard({"type": "assignment_update",
            "assignment": {"id": assignment_id, "status": "completed", "officer_id": officer_id}})
        return {"ok": True}
    finally:
        await conn.close()

@router.get("/officer/assignments")
async def my_assignments(officer_id: str = Depends(current_officer)):
    conn = await db.get_db()
    try:
        cur = await conn.execute("""
            SELECT * FROM assignments WHERE officer_id=?
            ORDER BY assigned_at DESC LIMIT 20
        """, (officer_id,))
        rows = await cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        await conn.close()

@router.get("/routing/distance")
async def routing_distance(src_lat: float, src_lng: float, dst_lat: float, dst_lng: float, _=Depends(current_user)):
    dist, eta = bidirectional_astar(src_lat, src_lng, dst_lat, dst_lng)
    return {"road_distance_km": dist, "eta_minutes": eta}
