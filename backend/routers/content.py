from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header, Query, Response
from core import db, get_optional_user, has_course_access, get_object
import jwt
from core import JWT_SECRET, JWT_ALG

router = APIRouter(prefix="/api", tags=["content"])


@router.get("/products")
async def list_products():
    return await db.products.find({"active": True}, {"_id": 0}).sort("created_at", -1).to_list(200)


@router.get("/products/{product_id}")
async def product_detail(product_id: str):
    p = await db.products.find_one({"$or": [{"id": product_id}, {"slug": product_id}], "active": True}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Product not found")
    return p


@router.get("/blog")
async def list_posts():
    return await db.posts.find({"published": True}, {"_id": 0, "content": 0}).sort("published_at", -1).to_list(200)


@router.get("/blog/{slug}")
async def post_detail(slug: str):
    p = await db.posts.find_one({"$or": [{"slug": slug}, {"id": slug}], "published": True}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Post not found")
    return p


@router.get("/settings")
async def public_settings():
    s = await db.settings.find_one({"key": "site"}, {"_id": 0}) or {}
    return s.get("value", {})


async def _user_from_query(auth: Optional[str]) -> Optional[dict]:
    if not auth:
        return None
    try:
        payload = jwt.decode(auth, JWT_SECRET, algorithms=[JWT_ALG])
        if not await db.sessions.find_one({"id": payload.get("sid")}):
            return None
        return await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    except jwt.InvalidTokenError:
        return None


@router.get("/files/{file_id}")
async def serve_file(file_id: str, user: Optional[dict] = Depends(get_optional_user),
                     auth: Optional[str] = Query(None), download: int = 0):
    rec = await db.files.find_one({"id": file_id, "is_deleted": False}, {"_id": 0})
    if not rec:
        raise HTTPException(404, "File not found")
    if not user:
        user = await _user_from_query(auth)
    if rec.get("scope") == "course":
        if not await has_course_access(user, rec["course_id"]):
            raise HTTPException(403, "Enroll to download this file")
    elif rec.get("scope") == "product":
        ok = user and (user.get("role") == "admin" or await db.product_access.find_one(
            {"user_id": user["id"], "product_id": rec["product_id"], "active": True}))
        if not ok:
            raise HTTPException(403, "Purchase this product to download")
    data, ct = get_object(rec["storage_path"])
    headers = {"Cache-Control": "private, max-age=3600"}
    if download:
        headers["Content-Disposition"] = f'attachment; filename="{rec.get("original_filename", "file")}"'
    return Response(content=data, media_type=rec.get("content_type", ct), headers=headers)
