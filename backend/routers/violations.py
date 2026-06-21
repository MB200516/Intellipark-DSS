from fastapi import APIRouter, Depends
from auth import current_user
import feedback as fb

router = APIRouter(prefix="/violations", tags=["feedback"])

@router.post("/log")
async def log_new_violation(junction: str, lat: float, lng: float,
                              violation_type: str = "NO PARKING",
                              vehicle_type: str = "CAR",
                              _=Depends(current_user)):
    fb.log_violation(junction, lat, lng, violation_type, vehicle_type, 3, 2)
    return {"ok": True, "message": "Violation logged, included in next model retrain"}
