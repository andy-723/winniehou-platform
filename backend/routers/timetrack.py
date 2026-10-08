from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from core import db, require_admin, new_id, now_iso

router = APIRouter(prefix="/api/admin", tags=["time"], dependencies=[Depends(require_admin)])
NO_ID = {"_id": 0}


def _parse(s):
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00") if isinstance(s, str) else s)
        return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
    except Exception:
        return None


def _minutes(start, end):
    a, b = _parse(start), _parse(end)
    if not a or not b:
        return 0
    return max(0, round((b - a).total_seconds() / 60))


# ---------- clients ----------
class ClientIn(BaseModel):
    first_name: str
    last_name: str = ""
    email: str = ""
    phone: str = ""
    linked_user_id: Optional[str] = None
    status: str = "active"
    service_package_key: Optional[str] = None


class EngagementIn(BaseModel):
    service_package_key: str
    hours_included: Optional[float] = None
    start_date: str = ""
    end_date: Optional[str] = None
    status: str = "active"
    notes: str = ""


async def _client_hours(client_id):
    rows = await db.time_entries.find({"client_id": client_id, "ended_at": {"$ne": None}}, {"_id": 0, "duration_minutes": 1}).to_list(5000)
    return round(sum(r.get("duration_minutes", 0) for r in rows) / 60, 1)


@router.get("/clients")
async def list_clients():
    rows = await db.coaching_clients.find({}, NO_ID).sort("created_at", -1).to_list(1000)
    for c in rows:
        engs = await db.client_engagements.find({"client_id": c["id"]}, NO_ID).to_list(50)
        pkgs = await db.service_packages.find({"key": {"$in": [e["service_package_key"] for e in engs]}}, NO_ID).to_list(50)
        pmap = {p["key"]: p for p in pkgs}
        c["engagements"] = engs
        c["packages"] = [pmap.get(e["service_package_key"], {}).get("name", e["service_package_key"]) for e in engs]
        c["hours_included"] = sum((e.get("hours_included") or pmap.get(e["service_package_key"], {}).get("hours_included") or 0) for e in engs) or None
        c["hours_used"] = await _client_hours(c["id"])
    return rows


@router.post("/clients")
async def create_client(body: ClientIn):
    data = body.model_dump()
    pkg_key = data.pop("service_package_key", None)
    if not pkg_key:
        raise HTTPException(400, "A package is required so an engagement exists")
    pkg = await db.service_packages.find_one({"key": pkg_key}, NO_ID)
    if not pkg:
        raise HTTPException(400, "Unknown package")
    doc = {**data, "id": new_id(), "created_at": now_iso()}
    await db.coaching_clients.insert_one(doc)
    doc.pop("_id", None)
    eng = {"id": new_id(), "client_id": doc["id"], "service_package_key": pkg_key,
           "hours_included": pkg.get("hours_included"), "start_date": now_iso()[:10],
           "end_date": None, "status": "active", "notes": "", "created_at": now_iso()}
    await db.client_engagements.insert_one(eng)
    return doc


@router.get("/clients/{cid}")
async def get_client(cid: str):
    c = await db.coaching_clients.find_one({"id": cid}, NO_ID)
    if not c:
        raise HTTPException(404, "Client not found")
    c["engagements"] = await db.client_engagements.find({"client_id": cid}, NO_ID).sort("start_date", -1).to_list(50)
    c["entries"] = await db.time_entries.find({"client_id": cid, "ended_at": {"$ne": None}}, NO_ID).sort("started_at", -1).to_list(200)
    c["hours_used"] = await _client_hours(cid)
    return c


@router.put("/clients/{cid}")
async def update_client(cid: str, body: ClientIn):
    data = body.model_dump()
    data.pop("service_package_key", None)
    await db.coaching_clients.update_one({"id": cid}, {"$set": data})
    return await db.coaching_clients.find_one({"id": cid}, NO_ID)


@router.delete("/clients/{cid}")
async def delete_client(cid: str):
    await db.client_engagements.delete_many({"client_id": cid})
    await db.time_entries.delete_many({"client_id": cid})
    await db.coaching_clients.delete_one({"id": cid})
    return {"ok": True}


@router.post("/clients/{cid}/engagements")
async def add_engagement(cid: str, body: EngagementIn):
    if not await db.coaching_clients.find_one({"id": cid}):
        raise HTTPException(404, "Client not found")
    doc = {**body.model_dump(), "id": new_id(), "client_id": cid, "created_at": now_iso()}
    await db.client_engagements.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/engagements/{eid}")
async def update_engagement(eid: str, body: EngagementIn):
    await db.client_engagements.update_one({"id": eid}, {"$set": body.model_dump()})
    return await db.client_engagements.find_one({"id": eid}, NO_ID)


@router.delete("/engagements/{eid}")
async def delete_engagement(eid: str):
    await db.client_engagements.delete_one({"id": eid})
    return {"ok": True}


# ---------- categories ----------
@router.get("/time/categories")
async def categories():
    return await db.time_categories.find({}, NO_ID).sort("order", 1).to_list(200)


# ---------- entry validation ----------
def _validate(subject_type, student_id, client_id, engagement_id):
    if subject_type == "student":
        if not student_id or client_id or engagement_id:
            raise HTTPException(400, "Student entries require student_id and no client fields")
    elif subject_type == "client":
        if not (client_id and engagement_id) or student_id:
            raise HTTPException(400, "Client entries require client_id + engagement_id and no student_id")
    elif subject_type == "internal":
        if student_id or client_id or engagement_id:
            raise HTTPException(400, "Internal entries take no subject")
    else:
        raise HTTPException(400, "Invalid subject_type")


# ---------- timer ----------
class TimerStart(BaseModel):
    subject_type: str
    description: str = ""
    category: str = ""
    student_id: Optional[str] = None
    course_id: Optional[str] = None
    client_id: Optional[str] = None
    engagement_id: Optional[str] = None
    billable: bool = False


@router.get("/time/timer")
async def get_timer(user: dict = Depends(require_admin)):
    return await db.time_entries.find_one({"user_id": user["id"], "ended_at": None}, NO_ID)


@router.post("/time/timer/start")
async def start_timer(body: TimerStart, user: dict = Depends(require_admin)):
    _validate(body.subject_type, body.student_id, body.client_id, body.engagement_id)
    # stop any running timer first
    running = await db.time_entries.find_one({"user_id": user["id"], "ended_at": None})
    if running:
        end = now_iso()
        await db.time_entries.update_one({"id": running["id"]}, {"$set": {"ended_at": end, "duration_minutes": _minutes(running["started_at"], end), "updated_at": end}})
    doc = {**body.model_dump(), "id": new_id(), "user_id": user["id"], "started_at": now_iso(),
           "ended_at": None, "duration_minutes": 0, "source": "timer", "created_at": now_iso(), "updated_at": now_iso()}
    await db.time_entries.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.post("/time/timer/stop")
async def stop_timer(user: dict = Depends(require_admin)):
    running = await db.time_entries.find_one({"user_id": user["id"], "ended_at": None}, NO_ID)
    if not running:
        raise HTTPException(404, "No running timer")
    end = now_iso()
    await db.time_entries.update_one({"id": running["id"]}, {"$set": {"ended_at": end, "duration_minutes": _minutes(running["started_at"], end), "updated_at": end}})
    return await db.time_entries.find_one({"id": running["id"]}, NO_ID)


# ---------- entries ----------
class EntryIn(BaseModel):
    subject_type: str
    description: str = ""
    category: str = ""
    student_id: Optional[str] = None
    course_id: Optional[str] = None
    client_id: Optional[str] = None
    engagement_id: Optional[str] = None
    started_at: str
    ended_at: str
    billable: bool = False


@router.get("/time/entries")
async def list_entries(subject_type: Optional[str] = None, student_id: Optional[str] = None,
                       client_id: Optional[str] = None, category: Optional[str] = None,
                       billable: Optional[bool] = None, date_from: Optional[str] = None, date_to: Optional[str] = None):
    q = {"ended_at": {"$ne": None}}
    if subject_type:
        q["subject_type"] = subject_type
    if student_id:
        q["student_id"] = student_id
    if client_id:
        q["client_id"] = client_id
    if category:
        q["category"] = category
    if billable is not None:
        q["billable"] = billable
    rows = await db.time_entries.find(q, NO_ID).sort("started_at", -1).to_list(2000)
    if date_from:
        rows = [r for r in rows if r["started_at"] >= date_from]
    if date_to:
        rows = [r for r in rows if r["started_at"] <= date_to + "T23:59:59"]
    return rows


@router.post("/time/entries")
async def create_entry(body: EntryIn):
    _validate(body.subject_type, body.student_id, body.client_id, body.engagement_id)
    doc = {**body.model_dump(), "id": new_id(), "user_id": None, "source": "manual",
           "duration_minutes": _minutes(body.started_at, body.ended_at), "created_at": now_iso(), "updated_at": now_iso()}
    await db.time_entries.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/time/entries/{eid}")
async def update_entry(eid: str, body: EntryIn):
    _validate(body.subject_type, body.student_id, body.client_id, body.engagement_id)
    patch = {**body.model_dump(), "duration_minutes": _minutes(body.started_at, body.ended_at), "updated_at": now_iso()}
    await db.time_entries.update_one({"id": eid}, {"$set": patch})
    return await db.time_entries.find_one({"id": eid}, NO_ID)


@router.delete("/time/entries/{eid}")
async def delete_entry(eid: str):
    await db.time_entries.delete_one({"id": eid})
    return {"ok": True}


# ---------- reports ----------
@router.get("/time/summary")
async def summary(date_from: Optional[str] = None, date_to: Optional[str] = None):
    rows = await list_entries(date_from=date_from, date_to=date_to)
    by_subject = {"client": 0, "student": 0, "internal": 0}
    billable = {"billable": 0, "non_billable": 0}
    by_cat = {}
    for r in rows:
        m = r.get("duration_minutes", 0)
        by_subject[r.get("subject_type", "internal")] = by_subject.get(r.get("subject_type", "internal"), 0) + m
        billable["billable" if r.get("billable") else "non_billable"] += m
        key = f'{r.get("subject_type")}: {r.get("category") or "Uncategorised"}'
        by_cat[key] = by_cat.get(key, 0) + m
    return {"total_minutes": sum(by_subject.values()), "by_subject": by_subject,
            "billable": billable, "by_category": sorted([{"category": k, "minutes": v} for k, v in by_cat.items()], key=lambda x: -x["minutes"]),
            "entries": len(rows)}


@router.get("/time/hours-week")
async def hours_week():
    monday = (datetime.now(timezone.utc) - timedelta(days=datetime.now(timezone.utc).weekday())).strftime("%Y-%m-%d")
    rows = await list_entries(date_from=monday)
    out = {"client": 0, "student": 0, "internal": 0}
    for r in rows:
        out[r.get("subject_type", "internal")] = out.get(r.get("subject_type", "internal"), 0) + r.get("duration_minutes", 0)
    return {k: round(v / 60, 1) for k, v in out.items()}


@router.get("/time/profitability")
async def profitability():
    engs = await db.client_engagements.find({}, NO_ID).to_list(1000)
    pkgs = {p["key"]: p for p in await db.service_packages.find({}, NO_ID).to_list(200)}
    clients = {c["id"]: c for c in await db.coaching_clients.find({}, NO_ID).to_list(1000)}
    out = []
    for e in engs:
        rows = await db.time_entries.find({"engagement_id": e["id"], "ended_at": {"$ne": None}}, {"_id": 0, "duration_minutes": 1}).to_list(5000)
        hours = round(sum(r.get("duration_minutes", 0) for r in rows) / 60, 2)
        pkg = pkgs.get(e["service_package_key"], {})
        price = pkg.get("price_cents", 0)
        c = clients.get(e["client_id"], {})
        out.append({
            "engagement_id": e["id"],
            "client": f'{c.get("first_name", "")} {c.get("last_name", "")}'.strip() or "—",
            "package": pkg.get("name", e["service_package_key"]),
            "price_cents": price,
            "hours": hours,
            "rate": round((price / 100) / hours, 2) if hours > 0 else None,
        })
    return out
