from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / ".env")

import os
import uuid
import logging
import bcrypt
import jwt
import requests
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import Request, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger("lms")

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
MAX_SESSIONS = int(os.environ.get("MAX_SESSIONS_PER_USER", "2"))
APP_NAME = os.environ.get("APP_NAME", "winnie-lms")


def now() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return now().isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def slugify(text: str) -> str:
    import re
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s or new_id()[:8]


# ---------- passwords / tokens ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str, sid: str) -> str:
    payload = {"sub": user_id, "email": email, "role": role, "sid": sid, "type": "access",
               "exp": now() + timedelta(hours=24)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def create_refresh_token(user_id: str, sid: str) -> str:
    payload = {"sub": user_id, "sid": sid, "type": "refresh", "exp": now() + timedelta(days=7)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def public_user(user: dict) -> dict:
    return {k: v for k, v in user.items() if k not in ("_id", "password_hash")}


async def create_session(user_id: str, request: Request) -> str:
    sid = new_id()
    sessions = await db.sessions.find({"user_id": user_id}).sort("created_at", 1).to_list(50)
    if len(sessions) >= MAX_SESSIONS:
        evict = [s["id"] for s in sessions[: len(sessions) - MAX_SESSIONS + 1]]
        await db.sessions.delete_many({"id": {"$in": evict}})
    await db.sessions.insert_one({
        "id": sid, "user_id": user_id, "user_agent": request.headers.get("user-agent", "")[:200],
        "ip": request.client.host if request.client else "", "created_at": now_iso(), "last_seen": now_iso(),
    })
    return sid


def _extract_token(request: Request) -> Optional[str]:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return request.cookies.get("access_token")


async def get_current_user(request: Request) -> dict:
    token = _extract_token(request)
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    if payload.get("type") != "access":
        raise HTTPException(401, "Invalid token type")
    session = await db.sessions.find_one({"id": payload.get("sid")})
    if not session:
        raise HTTPException(401, "Session expired or signed in on another device")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user:
        raise HTTPException(401, "User not found")
    if user.get("disabled"):
        raise HTTPException(403, "Account disabled")
    await db.sessions.update_one({"id": session["id"]}, {"$set": {"last_seen": now_iso()}})
    user["sid"] = session["id"]
    return public_user(user)


async def get_optional_user(request: Request) -> Optional[dict]:
    try:
        return await get_current_user(request)
    except HTTPException:
        return None


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    return user


# ---------- object storage ----------
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
_storage_key = None


def init_storage(force: bool = False):
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def get_object(path: str) -> tuple:
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---------- access helpers ----------
async def has_course_access(user: Optional[dict], course_id: str) -> bool:
    if not user:
        return False
    if user.get("role") == "admin":
        return True
    enr = await db.enrollments.find_one({"user_id": user["id"], "course_id": course_id, "active": True})
    return enr is not None
