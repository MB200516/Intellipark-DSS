from fastapi import FastAPI, Depends
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi import HTTPException
import database as db
from auth import USERS_DB, verify_pw, make_token
from data_store import store

import routers.dashboard as dashboard_router
import routers.hotspots as hotspots_router
import routers.violations as violations_router
import routers.officers as officers_router
import routers.assignments as assignments_router
import routers.websockets as websockets_router

app = FastAPI(title="IntelliPark DSS API", version="2.0.0")

app.add_middleware(CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# supervisor login, not router-isolated since it touches USERS_DB directly
@app.post("/auth/login")
async def login(form: OAuth2PasswordRequestForm = Depends()):
    u = USERS_DB.get(form.username)
    if not u or not verify_pw(form.password, u["hashed_password"]):
        raise HTTPException(400, "Incorrect credentials")
    return {"access_token": make_token({"sub": u["username"]}), "token_type": "bearer",
            "user": {k: u[k] for k in ("username", "full_name", "badge", "role")}}

@app.get("/health")
async def health():
    return {"status": "operational", "using_real_data": store.using_real_data,
            "hotspot_count": len(store.hotspots), "model_accuracy": store.metrics["accuracy"]}

@app.on_event("startup")
async def startup():
    await db.init_db()

app.include_router(dashboard_router.router)
app.include_router(hotspots_router.router)
app.include_router(violations_router.router)
app.include_router(officers_router.router)
app.include_router(assignments_router.router)
app.include_router(websockets_router.router)
