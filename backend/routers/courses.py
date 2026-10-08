import os
import time
import hashlib
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from core import db, get_current_user, get_optional_user, has_course_access, now_iso

router = APIRouter(prefix="/api", tags=["courses"])

BUNNY_LIBRARY_ID = os.environ.get("BUNNY_LIBRARY_ID", "")
BUNNY_TOKEN_KEY = os.environ.get("BUNNY_TOKEN_AUTH_KEY") or os.environ.get("BUNNY_STREAM_API_KEY", "")
TOKEN_TTL = int(os.environ.get("VIDEO_TOKEN_TTL_SECONDS", "7200"))

COURSE_PUBLIC = {"_id": 0}


def strip_lesson(lesson: dict, unlocked: bool) -> dict:
    out = {k: v for k, v in lesson.items() if k not in ("video_url", "bunny_video_id", "content", "attachments")}
    out["locked"] = not unlocked
    out["has_video"] = bool(lesson.get("video_url") or lesson.get("bunny_video_id"))
    out["attachment_count"] = len(lesson.get("attachments", []))
    return out


async def load_course(course_id_or_slug: str, published_only: bool = True) -> dict:
    q = {"$or": [{"id": course_id_or_slug}, {"slug": course_id_or_slug}]}
    if published_only:
        q["published"] = True
    course = await db.courses.find_one(q, COURSE_PUBLIC)
    if not course:
        raise HTTPException(404, "Course not found")
    return course


@router.get("/courses")
async def list_courses(level: Optional[str] = None, topic: Optional[str] = None, max_price: Optional[int] = None,
                       q: Optional[str] = None):
    query = {"published": True}
    if level:
        query["level"] = level
    if topic:
        query["topics"] = topic
    if max_price is not None:
        query["price"] = {"$lte": max_price}
    if q:
        query["$or"] = [{"title": {"$regex": q, "$options": "i"}}, {"subtitle": {"$regex": q, "$options": "i"}}]
    courses = await db.courses.find(query, COURSE_PUBLIC).sort("created_at", -1).to_list(200)
    for c in courses:
        c["lesson_count"] = sum(len(m.get("lessons", [])) for m in c.get("modules", []))
        c["module_count"] = len(c.get("modules", []))
        c.pop("modules", None)
    return courses


@router.get("/courses/filters")
async def course_filters():
    courses = await db.courses.find({"published": True}, {"_id": 0, "level": 1, "topics": 1}).to_list(500)
    levels = sorted({c.get("level") for c in courses if c.get("level")})
    topics = sorted({t for c in courses for t in c.get("topics", [])})
    return {"levels": levels, "topics": topics}


@router.get("/courses/{course_id}")
async def course_detail(course_id: str, user: Optional[dict] = Depends(get_optional_user)):
    course = await load_course(course_id)
    enrolled = await has_course_access(user, course["id"])
    for m in course.get("modules", []):
        m["lessons"] = [strip_lesson(l, enrolled or l.get("is_preview", False)) for l in m.get("lessons", [])]
    course["enrolled"] = enrolled
    course["enrollment_count"] = await db.enrollments.count_documents({"course_id": course["id"], "active": True})
    return course


def bunny_embed_url(video_id: str) -> str:
    expires = int(time.time()) + TOKEN_TTL
    token = hashlib.sha256((BUNNY_TOKEN_KEY + video_id + str(expires)).encode()).hexdigest()
    return f"https://player.mediadelivery.net/embed/{BUNNY_LIBRARY_ID}/{video_id}?token={token}&expires={expires}&autoplay=false"


@router.get("/courses/{course_id}/lessons/{lesson_id}")
async def lesson_detail(course_id: str, lesson_id: str, user: Optional[dict] = Depends(get_optional_user)):
    course = await load_course(course_id)
    lesson = next((l for m in course.get("modules", []) for l in m.get("lessons", []) if l["id"] == lesson_id), None)
    if not lesson:
        raise HTTPException(404, "Lesson not found")
    unlocked = await has_course_access(user, course["id"]) or lesson.get("is_preview", False)
    if not unlocked:
        raise HTTPException(403, "Enroll to access this lesson")
    out = dict(lesson)
    out["video"] = None
    if lesson.get("bunny_video_id") and BUNNY_LIBRARY_ID:
        out["video"] = {"provider": "bunny", "embed_url": bunny_embed_url(lesson["bunny_video_id"]),
                        "expires_in": TOKEN_TTL}
    elif lesson.get("video_url"):
        out["video"] = {"provider": "url", "src": lesson["video_url"], "expires_in": TOKEN_TTL}
    out.pop("video_url", None)
    out.pop("bunny_video_id", None)
    out["watermark"] = user["email"] if user else "preview"
    progress = None
    if user:
        progress = await db.progress.find_one({"user_id": user["id"], "lesson_id": lesson_id}, {"_id": 0})
    out["progress"] = progress
    return out


class ProgressIn(BaseModel):
    position_seconds: float = 0
    completed: bool = False


@router.post("/courses/{course_id}/lessons/{lesson_id}/progress")
async def save_progress(course_id: str, lesson_id: str, body: ProgressIn, user: dict = Depends(get_current_user)):
    course = await load_course(course_id)
    if not await has_course_access(user, course["id"]):
        raise HTTPException(403, "Not enrolled")
    existing = await db.progress.find_one({"user_id": user["id"], "lesson_id": lesson_id})
    completed = body.completed or (existing or {}).get("completed", False)
    await db.progress.update_one(
        {"user_id": user["id"], "lesson_id": lesson_id},
        {"$set": {"course_id": course["id"], "position_seconds": body.position_seconds, "completed": completed,
                  "updated_at": now_iso()}}, upsert=True)
    await db.enrollments.update_one({"user_id": user["id"], "course_id": course["id"]},
                                    {"$set": {"last_lesson_id": lesson_id, "last_accessed": now_iso()}})
    return {"ok": True, "completed": completed}


async def compute_progress(user_id: str, course: dict) -> dict:
    lesson_ids = [l["id"] for m in course.get("modules", []) for l in m.get("lessons", [])]
    rows = await db.progress.find({"user_id": user_id, "course_id": course["id"]}, {"_id": 0}).to_list(1000)
    by_lesson = {r["lesson_id"]: r for r in rows}
    done = sum(1 for lid in lesson_ids if by_lesson.get(lid, {}).get("completed"))
    modules = []
    for m in course.get("modules", []):
        ids = [l["id"] for l in m.get("lessons", [])]
        md = sum(1 for lid in ids if by_lesson.get(lid, {}).get("completed"))
        modules.append({"module_id": m["id"], "completed": md, "total": len(ids),
                        "percent": round(md / len(ids) * 100) if ids else 0})
    enr = await db.enrollments.find_one({"user_id": user_id, "course_id": course["id"]}, {"_id": 0})
    return {"course_id": course["id"], "completed": done, "total": len(lesson_ids),
            "percent": round(done / len(lesson_ids) * 100) if lesson_ids else 0, "modules": modules,
            "lessons": by_lesson, "last_lesson_id": (enr or {}).get("last_lesson_id")}


@router.get("/courses/{course_id}/progress")
async def course_progress(course_id: str, user: dict = Depends(get_current_user)):
    course = await load_course(course_id)
    return await compute_progress(user["id"], course)


@router.get("/me/courses")
async def my_courses(user: dict = Depends(get_current_user)):
    enrollments = await db.enrollments.find({"user_id": user["id"], "active": True}, {"_id": 0}).to_list(200)
    out = []
    for e in enrollments:
        course = await db.courses.find_one({"id": e["course_id"]}, COURSE_PUBLIC)
        if not course:
            continue
        prog = await compute_progress(user["id"], course)
        course.pop("modules", None)
        out.append({"course": course, "progress": prog, "enrolled_at": e.get("created_at")})
    return out
