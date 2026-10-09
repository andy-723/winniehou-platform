import os
import logging
from typing import Optional, List, Any
import httpx
import stripe
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from core import db, require_admin, new_id, now_iso, slugify, put_object, APP_NAME
from routers.courses import compute_progress

logger = logging.getLogger("lms.admin")
router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])

BUNNY_LIBRARY_ID = os.environ.get("BUNNY_LIBRARY_ID", "")
BUNNY_KEY = os.environ.get("BUNNY_STREAM_API_KEY", "")
NO_ID = {"_id": 0}


# ---------- student metrics helpers ----------
def _parse_dt(s):
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00") if isinstance(s, str) else s)
        return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
    except Exception:
        return None


async def student_metrics(user_id: str):
    enrs = await db.enrollments.find({"user_id": user_id, "active": True}, NO_ID).to_list(200)
    total = done = 0
    per_course = []
    last_active = None
    for e in enrs:
        course = await db.courses.find_one({"id": e["course_id"]}, NO_ID)
        if not course:
            continue
        prog = await compute_progress(user_id, course)
        total += prog["total"]
        done += prog["completed"]
        titles = {m["id"]: m.get("title", "") for m in course.get("modules", [])}
        per_course.append({
            "course_id": course["id"], "course_title": course.get("title", ""),
            "percent": prog["percent"], "completed": prog["completed"], "total": prog["total"],
            "modules": [{**m, "title": titles.get(m["module_id"], "")} for m in prog["modules"]],
        })
        la = _parse_dt(e.get("last_accessed"))
        if la and (last_active is None or la > last_active):
            last_active = la
    latest = await db.progress.find({"user_id": user_id}, {"_id": 0, "updated_at": 1}).sort("updated_at", -1).limit(1).to_list(1)
    if latest:
        la = _parse_dt(latest[0].get("updated_at"))
        if la and (last_active is None or la > last_active):
            last_active = la
    percent = round(done / total * 100) if total else 0
    now = datetime.now(timezone.utc)
    if enrs and total and percent >= 100:
        status = "completed"
    elif enrs and (last_active is None or (now - last_active) > timedelta(days=7)):
        status = "at_risk"
    else:
        status = "active"
    return {"percent": percent, "lessons_completed": done, "lessons_total": total,
            "last_active": last_active.isoformat() if last_active else None,
            "status": status, "per_course": per_course}


async def student_timeline(user_id: str, limit: int = 30):
    events = []
    prog = await db.progress.find({"user_id": user_id, "completed": True}, NO_ID).sort("updated_at", -1).limit(50).to_list(50)
    cache = {}
    for p in prog:
        cid = p.get("course_id")
        if cid not in cache:
            cache[cid] = await db.courses.find_one({"id": cid}, NO_ID)
        c = cache[cid]
        title = "a lesson"
        if c:
            for mm in c.get("modules", []):
                for l in mm.get("lessons", []):
                    if l["id"] == p.get("lesson_id"):
                        title = l.get("title", title)
        events.append({"type": "lesson", "label": f"Completed “{title}”", "at": p.get("updated_at")})
    orders = await db.orders.find({"user_id": user_id, "status": {"$in": ["paid", "refunded"]}}, NO_ID).sort("created_at", -1).limit(20).to_list(20)
    for o in orders:
        items = ", ".join(i.get("title", "item") for i in o.get("items", [])) or "an order"
        events.append({"type": "purchase", "label": f"Purchased {items}", "at": o.get("created_at")})
    events = [e for e in events if e.get("at")]
    events.sort(key=lambda e: e["at"], reverse=True)
    return events[:limit]


# ---------- dashboard ----------
@router.get("/dashboard")
async def dashboard():
    paid = await db.orders.find({"status": {"$in": ["paid", "refunded"]}}, NO_ID).to_list(5000)
    revenue = sum(o["total"] for o in paid if o["status"] == "paid")
    refunded = sum(o["total"] for o in paid if o["status"] == "refunded")
    monthly = {}
    for o in paid:
        if o["status"] == "paid":
            k = o["created_at"][:7]
            monthly[k] = monthly.get(k, 0) + o["total"]
    pipeline = [{"$match": {"active": True}}, {"$group": {"_id": "$course_id", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}}, {"$limit": 5}]
    top = await db.enrollments.aggregate(pipeline).to_list(5)
    top_courses = []
    for t in top:
        c = await db.courses.find_one({"id": t["_id"]}, {"_id": 0, "title": 1, "id": 1, "price": 1})
        if c:
            top_courses.append({**c, "enrollments": t["count"]})
    enrolled_ids = await db.enrollments.distinct("user_id", {"active": True})
    at_risk = 0
    pct_sum = 0
    for uid in enrolled_ids:
        m = await student_metrics(uid)
        if m["status"] == "at_risk":
            at_risk += 1
        pct_sum += m["percent"]
    avg_completion = round(pct_sum / len(enrolled_ids)) if enrolled_ids else 0
    return {
        "revenue": revenue, "refunded": refunded, "orders": len([o for o in paid if o["status"] == "paid"]),
        "students": await db.users.count_documents({"role": "student"}),
        "active_students": len(enrolled_ids),
        "at_risk_students": at_risk, "avg_completion": avg_completion,
        "courses": await db.courses.count_documents({}), "published_courses": await db.courses.count_documents({"published": True}),
        "monthly": [{"month": k, "revenue": v} for k, v in sorted(monthly.items())][-12:],
        "top_courses": top_courses,
        "recent_orders": await db.orders.find({"status": {"$in": ["paid", "refunded"]}}, NO_ID).sort("created_at", -1).limit(8).to_list(8),
    }


# ---------- courses ----------
class CourseIn(BaseModel):
    title: str
    subtitle: str = ""
    description: str = ""
    level: str = "Intermediate"
    topics: List[str] = []
    price: int = 0
    thumbnail_url: str = ""
    published: bool = False
    outcomes: List[str] = []
    audience: List[str] = []
    duration_hours: float = 0
    modules: Optional[List[Any]] = None


@router.get("/courses")
async def admin_courses():
    rows = await db.courses.find({}, NO_ID).sort("created_at", -1).to_list(500)
    for c in rows:
        c["enrollments"] = await db.enrollments.count_documents({"course_id": c["id"], "active": True})
    return rows


@router.post("/courses")
async def create_course(body: CourseIn):
    doc = body.model_dump(exclude={"modules"})
    doc.update({"id": new_id(), "slug": slugify(body.title), "modules": body.modules or [],
                "created_at": now_iso(), "updated_at": now_iso()})
    await db.courses.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/courses/{course_id}")
async def admin_course(course_id: str):
    c = await db.courses.find_one({"id": course_id}, NO_ID)
    if not c:
        raise HTTPException(404, "Course not found")
    return c


def _normalize_modules(modules: list) -> list:
    out = []
    for i, m in enumerate(modules or []):
        lessons = []
        for j, l in enumerate(m.get("lessons", [])):
            lessons.append({"id": l.get("id") or new_id(), "title": l.get("title", "Untitled lesson"),
                            "content": l.get("content", ""), "video_url": l.get("video_url", ""),
                            "bunny_video_id": l.get("bunny_video_id", ""), "duration_minutes": l.get("duration_minutes", 0),
                            "is_preview": bool(l.get("is_preview", False)), "attachments": l.get("attachments", []),
                            "order": j})
        out.append({"id": m.get("id") or new_id(), "title": m.get("title", "Untitled module"),
                    "description": m.get("description", ""), "lessons": lessons, "order": i})
    return out


@router.put("/courses/{course_id}")
async def update_course(course_id: str, body: CourseIn):
    doc = body.model_dump(exclude={"modules"})
    if body.modules is not None:
        doc["modules"] = _normalize_modules(body.modules)
    doc["updated_at"] = now_iso()
    res = await db.courses.update_one({"id": course_id}, {"$set": doc})
    if not res.matched_count:
        raise HTTPException(404, "Course not found")
    return await db.courses.find_one({"id": course_id}, NO_ID)


@router.delete("/courses/{course_id}")
async def delete_course(course_id: str):
    await db.courses.delete_one({"id": course_id})
    return {"ok": True}


# ---------- uploads ----------
@router.post("/upload")
async def upload_file(file: UploadFile = File(...), scope: str = Form("public"), course_id: str = Form(""),
                      product_id: str = Form("")):
    data = await file.read()
    if len(data) > 50 * 1024 * 1024:
        raise HTTPException(413, "File too large (max 50MB)")
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "bin"
    fid = new_id()
    path = f"{APP_NAME}/{scope}/{fid}.{ext}"
    try:
        result = put_object(path, data, file.content_type or "application/octet-stream")
    except Exception as e:
        logger.error(f"Storage upload failed: {e}")
        raise HTTPException(502, "File storage unavailable")
    rec = {"id": fid, "storage_path": result["path"], "original_filename": file.filename,
           "content_type": file.content_type, "size": result.get("size", len(data)), "scope": scope,
           "course_id": course_id, "product_id": product_id, "is_deleted": False, "created_at": now_iso()}
    await db.files.insert_one(rec)
    rec.pop("_id", None)
    rec["url"] = f"/api/files/{fid}"
    return rec


@router.get("/bunny/status")
async def bunny_status():
    return {"configured": bool(BUNNY_LIBRARY_ID and BUNNY_KEY), "library_id": BUNNY_LIBRARY_ID}


@router.post("/videos")
async def upload_video(title: str = Form(...), file: UploadFile = File(...)):
    if not (BUNNY_LIBRARY_ID and BUNNY_KEY):
        raise HTTPException(503, "Bunny Stream is not configured. Add BUNNY_LIBRARY_ID and BUNNY_STREAM_API_KEY.")
    if file.content_type and not file.content_type.startswith("video/"):
        raise HTTPException(415, "Only video uploads are accepted")
    headers = {"AccessKey": BUNNY_KEY, "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=httpx.Timeout(600.0)) as client:
        created = await client.post(f"https://video.bunnycdn.com/library/{BUNNY_LIBRARY_ID}/videos",
                                    json={"title": title}, headers=headers)
        if created.status_code >= 400:
            raise HTTPException(502, f"Bunny create failed: {created.text[:300]}")
        video_id = created.json().get("guid")

        async def body():
            while chunk := await file.read(1024 * 1024):
                yield chunk

        up = await client.put(f"https://video.bunnycdn.com/library/{BUNNY_LIBRARY_ID}/videos/{video_id}",
                              content=body(), headers={**headers, "Content-Type": "application/octet-stream"})
        if up.status_code >= 400:
            raise HTTPException(502, f"Bunny upload failed: {up.text[:300]}")
    await db.videos.insert_one({"bunny_video_id": video_id, "title": title, "filename": file.filename,
                               "status": "processing", "created_at": now_iso()})
    return {"video_id": video_id, "status": "processing"}


# ---------- students ----------
@router.get("/students")
async def students(q: Optional[str] = None):
    query = {"role": "student"}
    if q:
        query["$or"] = [{"email": {"$regex": q, "$options": "i"}}, {"name": {"$regex": q, "$options": "i"}}]
    rows = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    for u in rows:
        u["enrollments"] = await db.enrollments.count_documents({"user_id": u["id"], "active": True})
        u["spent"] = sum(o["total"] for o in await db.orders.find({"user_id": u["id"], "status": "paid"}, {"_id": 0, "total": 1}).to_list(500))
        u["sessions"] = await db.sessions.count_documents({"user_id": u["id"]})
        m = await student_metrics(u["id"])
        u["progress_percent"] = m["percent"]
        u["lessons_completed"] = m["lessons_completed"]
        u["last_active"] = m["last_active"]
        u["status"] = m["status"]
        u["coach_minutes"] = sum(e.get("duration_minutes", 0) for e in await db.time_entries.find({"student_id": u["id"], "ended_at": {"$ne": None}}, {"_id": 0, "duration_minutes": 1}).to_list(2000))
    return rows


@router.get("/students/{user_id}")
async def student_detail(user_id: str):
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(404, "Student not found")
    enr = await db.enrollments.find({"user_id": user_id}, NO_ID).to_list(100)
    for e in enr:
        c = await db.courses.find_one({"id": e["course_id"]}, {"_id": 0, "title": 1})
        e["course_title"] = c["title"] if c else "?"
    u["enrollments"] = enr
    u["orders"] = await db.orders.find({"user_id": user_id}, NO_ID).sort("created_at", -1).to_list(100)
    u["sessions"] = await db.sessions.find({"user_id": user_id}, NO_ID).to_list(10)
    u["metrics"] = await student_metrics(user_id)
    u["timeline"] = await student_timeline(user_id)
    u["admin_notes"] = u.get("admin_notes", "")
    return u


class StudentPatch(BaseModel):
    disabled: Optional[bool] = None
    grant_course_id: Optional[str] = None
    revoke_course_id: Optional[str] = None
    clear_sessions: bool = False
    notes: Optional[str] = None


@router.patch("/students/{user_id}")
async def patch_student(user_id: str, body: StudentPatch):
    if body.disabled is not None:
        await db.users.update_one({"id": user_id}, {"$set": {"disabled": body.disabled}})
        if body.disabled:
            await db.sessions.delete_many({"user_id": user_id})
    if body.grant_course_id:
        await db.enrollments.update_one({"user_id": user_id, "course_id": body.grant_course_id},
                                        {"$set": {"active": True, "granted_by_admin": True, "updated_at": now_iso()},
                                         "$setOnInsert": {"id": new_id(), "created_at": now_iso()}}, upsert=True)
    if body.revoke_course_id:
        await db.enrollments.update_one({"user_id": user_id, "course_id": body.revoke_course_id}, {"$set": {"active": False}})
    if body.clear_sessions:
        await db.sessions.delete_many({"user_id": user_id})
    if body.notes is not None:
        await db.users.update_one({"id": user_id}, {"$set": {"admin_notes": body.notes}})
    return {"ok": True}


# ---------- orders / refunds ----------
@router.get("/orders")
async def orders(status: Optional[str] = None):
    q = {"status": status} if status else {"status": {"$in": ["paid", "refunded", "failed"]}}
    return await db.orders.find(q, NO_ID).sort("created_at", -1).to_list(1000)


@router.post("/orders/{order_id}/refund")
async def refund_order(order_id: str):
    order = await db.orders.find_one({"id": order_id}, NO_ID)
    if not order:
        raise HTTPException(404, "Order not found")
    if order["status"] != "paid":
        raise HTTPException(400, "Only paid orders can be refunded")
    if order.get("stripe_payment_intent_id"):
        try:
            stripe.Refund.create(payment_intent=order["stripe_payment_intent_id"])
        except stripe.error.StripeError as e:
            raise HTTPException(502, f"Stripe refund failed: {e.user_message or str(e)}")
    for i in order["items"]:
        if i["type"] == "course":
            await db.enrollments.update_one({"user_id": order["user_id"], "course_id": i["id"]}, {"$set": {"active": False}})
        else:
            await db.product_access.update_one({"user_id": order["user_id"], "product_id": i["id"]}, {"$set": {"active": False}})
    await db.orders.update_one({"id": order_id}, {"$set": {"status": "refunded", "refunded_at": now_iso(), "updated_at": now_iso()}})
    return {"ok": True}


# ---------- coupons ----------
class CouponIn(BaseModel):
    code: str
    kind: str = "percent"
    value: int
    max_uses: Optional[int] = None
    expires_at: Optional[str] = None
    active: bool = True


@router.get("/coupons")
async def coupons():
    return await db.coupons.find({}, NO_ID).sort("created_at", -1).to_list(500)


@router.post("/coupons")
async def create_coupon(body: CouponIn):
    code = body.code.strip().upper()
    if await db.coupons.find_one({"code": code}):
        raise HTTPException(400, "Coupon code already exists")
    doc = {**body.model_dump(), "code": code, "id": new_id(), "uses": 0, "created_at": now_iso()}
    await db.coupons.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.patch("/coupons/{coupon_id}")
async def toggle_coupon(coupon_id: str, active: bool):
    await db.coupons.update_one({"id": coupon_id}, {"$set": {"active": active}})
    return {"ok": True}


@router.delete("/coupons/{coupon_id}")
async def delete_coupon(coupon_id: str):
    await db.coupons.delete_one({"id": coupon_id})
    return {"ok": True}


# ---------- products ----------
class ProductIn(BaseModel):
    title: str
    description: str = ""
    price: int = 0
    image_url: str = ""
    file_id: str = ""
    active: bool = True
    kind: str = "workbook"


@router.get("/products")
async def admin_products():
    return await db.products.find({}, NO_ID).sort("created_at", -1).to_list(500)


@router.post("/products")
async def create_product(body: ProductIn):
    doc = {**body.model_dump(), "id": new_id(), "slug": slugify(body.title), "created_at": now_iso()}
    await db.products.insert_one(doc)
    if body.file_id:
        await db.files.update_one({"id": body.file_id}, {"$set": {"scope": "product", "product_id": doc["id"]}})
    doc.pop("_id", None)
    return doc


@router.put("/products/{product_id}")
async def update_product(product_id: str, body: ProductIn):
    await db.products.update_one({"id": product_id}, {"$set": {**body.model_dump(), "updated_at": now_iso()}})
    if body.file_id:
        await db.files.update_one({"id": body.file_id}, {"$set": {"scope": "product", "product_id": product_id}})
    return await db.products.find_one({"id": product_id}, NO_ID)


@router.delete("/products/{product_id}")
async def delete_product(product_id: str):
    await db.products.delete_one({"id": product_id})
    return {"ok": True}


# ---------- blog ----------
class PostIn(BaseModel):
    title: str
    excerpt: str = ""
    content: str = ""
    cover_url: str = ""
    published: bool = False
    tags: List[str] = []


@router.get("/posts")
async def admin_posts():
    return await db.posts.find({}, NO_ID).sort("created_at", -1).to_list(500)


@router.post("/posts")
async def create_post(body: PostIn):
    doc = {**body.model_dump(), "id": new_id(), "slug": slugify(body.title), "created_at": now_iso(),
           "published_at": now_iso() if body.published else None}
    await db.posts.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/posts/{post_id}")
async def update_post(post_id: str, body: PostIn):
    existing = await db.posts.find_one({"id": post_id}, NO_ID)
    if not existing:
        raise HTTPException(404, "Post not found")
    doc = {**body.model_dump(), "updated_at": now_iso()}
    if body.published and not existing.get("published_at"):
        doc["published_at"] = now_iso()
    await db.posts.update_one({"id": post_id}, {"$set": doc})
    return await db.posts.find_one({"id": post_id}, NO_ID)


@router.delete("/posts/{post_id}")
async def delete_post(post_id: str):
    await db.posts.delete_one({"id": post_id})
    return {"ok": True}


# ---------- services ----------
class ServicePackageIn(BaseModel):
    key: str
    name: str
    tagline: str = ""
    description: str = ""
    inclusions: List[str] = []
    situation_quote: str = ""
    for_you_if: List[str] = []
    outcomes_intro: str = ""
    duration_label: str = ""
    price_cents: int = 0
    gst_treatment: str = "ex_gst"
    sort_order: int = 0
    status: str = "draft"
    cta_type: str = "enquire"


@router.get("/services")
async def admin_services():
    return await db.service_packages.find({}, NO_ID).sort("sort_order", 1).to_list(200)


@router.post("/services")
async def create_service(body: ServicePackageIn):
    key = slugify(body.key or body.name)
    if await db.service_packages.find_one({"key": key}):
        raise HTTPException(400, "A package with this key already exists")
    doc = {**body.model_dump(), "key": key, "id": new_id(), "currency": "AUD",
           "created_at": now_iso(), "updated_at": now_iso()}
    await db.service_packages.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/services/{sid}")
async def update_service(sid: str, body: ServicePackageIn):
    key = slugify(body.key or body.name)
    clash = await db.service_packages.find_one({"key": key, "id": {"$ne": sid}})
    if clash:
        raise HTTPException(400, "Another package already uses this key")
    doc = {**body.model_dump(), "key": key, "updated_at": now_iso()}
    res = await db.service_packages.update_one({"id": sid}, {"$set": doc})
    if not res.matched_count:
        raise HTTPException(404, "Package not found")
    return await db.service_packages.find_one({"id": sid}, NO_ID)


@router.delete("/services/{sid}")
async def delete_service(sid: str):
    await db.service_packages.delete_one({"id": sid})
    return {"ok": True}


@router.get("/service-enquiries")
async def admin_service_enquiries():
    return await db.service_enquiries.find({}, NO_ID).sort("created_at", -1).to_list(1000)


@router.patch("/service-enquiries/{eid}")
async def mark_enquiry(eid: str, contacted: bool = True):
    await db.service_enquiries.update_one({"id": eid}, {"$set": {"contacted": contacted}})
    return {"ok": True}


@router.get("/waitlist")
async def admin_waitlist():
    return await db.waitlist.find({}, NO_ID).sort("created_at", -1).to_list(1000)


@router.get("/lead-visits")
async def admin_lead_visits():
    return await db.lead_visits.find({}, NO_ID).sort("created_at", -1).to_list(1000)
