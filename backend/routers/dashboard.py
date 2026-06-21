from fastapi import APIRouter, Depends
from datetime import datetime
from auth import current_user
from data_store import store, PATROL_UNITS
from feedback import feedback_count

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/kpi")
async def kpi(_=Depends(current_user)):
    rows = store.sorted_by_risk()
    return {
        "total_hotspots": len(rows),
        "critical_hotspots": sum(1 for r in rows if r["risk_level"] == "Critical"),
        "high_risk_hotspots": sum(1 for r in rows if r["risk_level"] == "High"),
        "predicted_violations": sum(r["predicted_violations"] for r in rows),
        "available_patrol_units": sum(1 for u in PATROL_UNITS if u["status"] == "Available"),
        "using_real_data": store.using_real_data,
        "model_accuracy": store.metrics["accuracy"],
        "feedback_logged": feedback_count(),
        "last_updated": datetime.now().strftime("%d %b %Y, %H:%M hrs"),
    }

@router.get("/chart/by-zone")
async def chart_by_zone(_=Depends(current_user)):
    zm = {}
    for h in store.hotspots:
        z = h.get("zone", "Unknown")
        zm.setdefault(z, {"zone": z, "predicted_violations": 0, "hotspot_count": 0})
        zm[z]["predicted_violations"] += h["predicted_violations"]
        zm[z]["hotspot_count"] += 1
    return sorted(zm.values(), key=lambda x: x["predicted_violations"], reverse=True)

@router.get("/chart/risk-distribution")
async def chart_risk(_=Depends(current_user)):
    counts = {"Critical": 0, "High": 0, "Moderate": 0, "Low": 0}
    seen_junctions = set()
    for h in store.hotspots:
        # count unique junctions, not hourly rows
        if h["junction"] in seen_junctions:
            continue
        seen_junctions.add(h["junction"])
        counts[h["risk_level"]] += 1
    return [{"level": k, "count": v} for k, v in counts.items()]

@router.get("/chart/top-junctions")
async def chart_top(_=Depends(current_user)):
    by_junction = {}
    for h in store.hotspots:
        j = h["junction"]
        by_junction.setdefault(j, {"junction": j, "predicted_violations": 0, "risk_score": h["risk_score"], "risk_level": h["risk_level"]})
        by_junction[j]["predicted_violations"] += h["predicted_violations"]
    rows = sorted(by_junction.values(), key=lambda x: x["predicted_violations"], reverse=True)
    return rows[:8]

@router.get("/chart/by-hour")
async def chart_by_hour(_=Depends(current_user)):
    hours = {}
    for h in store.hotspots:
        hr = h.get("forecast_hour")
        if hr is None:
            continue
        hours.setdefault(hr, 0)
        hours[hr] += h["predicted_violations"]
    return [{"hour": f"{h:02d}:00", "violations": v} for h, v in sorted(hours.items())]
