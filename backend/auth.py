from fastapi import HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from datetime import datetime, timedelta
import hashlib

SECRET_KEY = "intellipark-bengaluru-traffic-police-2024"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

USERS_DB = {"admin": {
    "username": "admin", "full_name": "Supt. Rajesh Kumar",
    "badge": "BTP-2241", "role": "Superintendent",
    "hashed_password": None,
}}

def hash_pw(p):
    return hashlib.sha256(p.encode()).hexdigest()

def verify_pw(p, h):
    return hash_pw(p) == h

USERS_DB["admin"]["hashed_password"] = hash_pw("admin123")

def make_token(data: dict):
    exp = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({**data, "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)

async def current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        u = payload.get("sub")
        if not u or u not in USERS_DB:
            raise HTTPException(401, "Invalid")
        return USERS_DB[u]
    except JWTError:
        raise HTTPException(401, "Invalid token")

async def current_officer(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub", "")
        if not sub.startswith("officer:"):
            raise HTTPException(401, "Not an officer token")
        return sub.split(":", 1)[1]
    except JWTError:
        raise HTTPException(401, "Invalid token")
