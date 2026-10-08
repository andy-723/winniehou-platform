import secrets
from datetime import timedelta
from fastapi import APIRouter, Request, Response, HTTPException, Depends
from pydantic import BaseModel, EmailStr, Field
from core import (db, hash_password, verify_password, create_access_token, create_refresh_token,
                  create_session, get_current_user, public_user, new_id, now, now_iso)
from emailer import send_password_reset
import jwt
from core import JWT_SECRET, JWT_ALG

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ForgotIn(BaseModel):
    email: EmailStr
    origin_url: str


class ResetIn(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)


def _set_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=86400, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=604800, path="/")


async def _issue(user: dict, request: Request, response: Response) -> dict:
    sid = await create_session(user["id"], request)
    access = create_access_token(user["id"], user["email"], user["role"], sid)
    refresh = create_refresh_token(user["id"], sid)
    _set_cookies(response, access, refresh)
    return {"user": public_user(user), "access_token": access}


@router.post("/register")
async def register(body: RegisterIn, request: Request, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "An account with this email already exists")
    user = {"id": new_id(), "name": body.name.strip(), "email": email, "password_hash": hash_password(body.password),
            "role": "student", "created_at": now_iso(), "disabled": False}
    await db.users.insert_one(user)
    return await _issue(user, request, response)


@router.post("/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower()
    ident = f"{request.client.host if request.client else 'x'}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": ident})
    if attempt and attempt.get("count", 0) >= 5 and attempt.get("locked_until", "") > now_iso():
        raise HTTPException(429, "Too many failed attempts. Try again in 15 minutes.")
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        await db.login_attempts.update_one({"identifier": ident}, {
            "$inc": {"count": 1}, "$set": {"locked_until": (now() + timedelta(minutes=15)).isoformat()}}, upsert=True)
        raise HTTPException(401, "Invalid email or password")
    if user.get("disabled"):
        raise HTTPException(403, "Account disabled")
    await db.login_attempts.delete_one({"identifier": ident})
    return await _issue(user, request, response)


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(401, "No refresh token")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid refresh token")
    if payload.get("type") != "refresh" or not await db.sessions.find_one({"id": payload["sid"]}):
        raise HTTPException(401, "Session expired")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user:
        raise HTTPException(401, "User not found")
    access = create_access_token(user["id"], user["email"], user["role"], payload["sid"])
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=86400, path="/")
    return {"user": public_user(user), "access_token": access}


@router.post("/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    await db.sessions.delete_one({"id": user.get("sid")})
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@router.get("/sessions")
async def sessions(user: dict = Depends(get_current_user)):
    rows = await db.sessions.find({"user_id": user["id"]}, {"_id": 0}).to_list(10)
    for r in rows:
        r["current"] = r["id"] == user.get("sid")
    return rows


@router.delete("/sessions/{sid}")
async def revoke_session(sid: str, user: dict = Depends(get_current_user)):
    await db.sessions.delete_one({"id": sid, "user_id": user["id"]})
    return {"ok": True}


@router.post("/forgot-password")
async def forgot_password(body: ForgotIn):
    user = await db.users.find_one({"email": body.email.lower()})
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "token": token, "user_id": user["id"], "used": False, "expires_at": now() + timedelta(hours=1)})
        await send_password_reset(user["email"], f"{body.origin_url.rstrip('/')}/reset-password?token={token}")
    return {"ok": True, "message": "If that email exists, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(body: ResetIn):
    rec = await db.password_reset_tokens.find_one({"token": body.token, "used": False})
    if not rec or rec["expires_at"].replace(tzinfo=now().tzinfo) < now():
        raise HTTPException(400, "Reset link is invalid or has expired")
    await db.users.update_one({"id": rec["user_id"]}, {"$set": {"password_hash": hash_password(body.password)}})
    await db.password_reset_tokens.update_one({"token": body.token}, {"$set": {"used": True}})
    await db.sessions.delete_many({"user_id": rec["user_id"]})
    return {"ok": True}
