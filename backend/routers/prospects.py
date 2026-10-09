"""Prospects pipeline (F1 core). Admin management + two public intake pages.
Google Drive/Calendar are deferred: files go to app object storage and booking
shows the WeChat fallback until Google is connected."""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from core import db, require_admin, new_id, now_iso, put_object, APP_NAME
import ai

NO_ID = {"_id": 0}
STATUS_FLOW = ["new", "call_booked", "call_done", "cdp_draft", "cdp_review", "plan_sent", "plan_viewed", "accepted", "paid"]

public_router = APIRouter(prefix="/api", tags=["intake"])
router = APIRouter(prefix="/api/admin", tags=["prospects"], dependencies=[Depends(require_admin)])


async def _log(prospect_id: str, action: str, by: str = "system", meta: dict = None):
    await db.prospect_activity.insert_one({"id": new_id(), "prospect_id": prospect_id, "action": action,
                                           "by": by, "meta": meta or {}, "at": now_iso()})


async def _find_dup(email: str, mobile: str):
    ors = []
    if email:
        ors.append({"email": email.lower().strip()})
    if mobile:
        ors.append({"mobile": mobile.strip()})
    if not ors:
        return None
    return await db.prospects.find_one({"$or": ors}, NO_ID)


async def _enrich(p: dict):
    p["activity"] = await db.prospect_activity.find({"prospect_id": p["id"]}, NO_ID).sort("at", -1).to_list(200)
    p["time_entries"] = await db.time_entries.find({"prospect_id": p["id"], "ended_at": {"$ne": None}}, NO_ID).sort("started_at", -1).to_list(200)
    p["minutes"] = sum(e.get("duration_minutes", 0) for e in p["time_entries"])
    if p.get("resume_file_id"):
        p["resume_file"] = await db.files.find_one({"id": p["resume_file_id"]}, {"_id": 0, "id": 1, "original_filename": 1, "content_type": 1})
    return p


# ---------------- public intake ----------------
class IntakeIn(BaseModel):
    first_name: str
    last_name: str = ""
    mobile: str = ""
    email: str = ""
    wechat_id: str = ""
    resume_file_id: Optional[str] = None
    send_resume_later: bool = False
    call_mode: str = "meet"            # meet | phone
    call_type: str = "booked"          # booked | adhoc
    source: str = "wechat"
    pkg: str = ""
    consent: bool = False


@public_router.post("/intake/resume")
async def intake_resume(file: UploadFile = File(...)):
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(413, "Resume too large (max 10MB)")
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "bin"
    if ext not in ("pdf", "doc", "docx"):
        raise HTTPException(415, "Please upload a PDF or Word file")
    fid = new_id()
    path = f"{APP_NAME}/prospect/{fid}.{ext}"
    try:
        result = put_object(path, data, file.content_type or "application/octet-stream")
    except Exception:
        raise HTTPException(502, "File storage unavailable, please try again")
    text = ai.extract_text(data, file.filename)
    await db.files.insert_one({"id": fid, "storage_path": result["path"], "original_filename": file.filename,
                               "content_type": file.content_type, "size": result.get("size", len(data)),
                               "scope": "prospect", "resume_text": text, "is_deleted": False, "created_at": now_iso()})
    return {"file_id": fid, "filename": file.filename}


async def _upsert_prospect(body: IntakeIn, by: str):
    dup = await _find_dup(body.email, body.mobile)
    base = {"first_name": body.first_name.strip(), "last_name": body.last_name.strip(),
            "email": body.email.lower().strip(), "mobile": body.mobile.strip(), "wechat_id": body.wechat_id.strip(),
            "source": body.source or "wechat", "call_mode": body.call_mode, "call_type": body.call_type,
            "pkg": body.pkg or "", "consent": bool(body.consent), "updated_at": now_iso()}
    if body.consent:
        base["consent_at"] = now_iso()
    if body.resume_file_id:
        base["resume_file_id"] = body.resume_file_id
    if dup:
        pid = dup["id"]
        await db.prospects.update_one({"id": pid}, {"$set": base})
        await _log(pid, "updated via intake form", by)
    else:
        pid = new_id()
        doc = {**base, "id": pid, "preferred_name": body.first_name.strip(), "pronoun": "",
               "status": "new", "lost_reason": "", "client_id": None, "resume_text": "",
               "consent_at": now_iso() if body.consent else None, "suggestions": None,
               "created_at": now_iso()}
        await db.prospects.insert_one(doc)
        await _log(pid, "prospect created", by)
    # resume parse (best-effort, non-blocking failure)
    if body.resume_file_id:
        f = await db.files.find_one({"id": body.resume_file_id}, {"_id": 0, "resume_text": 1})
        sug = await ai.parse_resume((f or {}).get("resume_text", ""))
        if sug:
            await db.prospects.update_one({"id": pid}, {"$set": {"suggestions": sug}})
            await _log(pid, "resume read by Claude", "system")
    return pid


@public_router.post("/intake/submit")
async def intake_submit(body: IntakeIn):
    if not body.consent:
        raise HTTPException(400, "Consent is required")
    if not body.first_name.strip():
        raise HTTPException(400, "Name is required")
    pid = await _upsert_prospect(body, by="prospect")
    calendar_connected = bool(await db.settings.find_one({"key": "google_calendar", "connected": True}))
    if body.call_type == "booked":
        msg = ("Winnie will contact you on WeChat to arrange a time."
               if not calendar_connected else "Choose a time below.")
    else:
        msg = "Thanks, Winnie will call you shortly."
    return {"ok": True, "prospect_id": pid, "calendar_connected": calendar_connected, "message": msg}


# ---------------- admin ----------------
class ProspectIn(BaseModel):
    first_name: str
    last_name: str = ""
    preferred_name: str = ""
    email: str = ""
    mobile: str = ""
    wechat_id: str = ""
    source: str = "wechat"
    pronoun: str = ""
    pkg: str = ""
    resume_file_id: Optional[str] = None
    consent: bool = False


class StatusIn(BaseModel):
    status: str


class LostIn(BaseModel):
    reason: str = ""


@router.get("/prospects")
async def list_prospects(q: str = "", source: str = "", status: str = "",
                         date_from: str = "", date_to: str = ""):
    query = {}
    if source:
        query["source"] = source
    if status:
        query["status"] = status
    if q:
        rx = {"$regex": q, "$options": "i"}
        query["$or"] = [{"first_name": rx}, {"last_name": rx}, {"email": rx}, {"mobile": rx}, {"wechat_id": rx}]
    rows = await db.prospects.find(query, NO_ID).sort("created_at", -1).to_list(2000)
    if date_from:
        rows = [r for r in rows if r.get("created_at", "") >= date_from]
    if date_to:
        rows = [r for r in rows if r.get("created_at", "") <= date_to + "T23:59:59"]
    counts = {s: 0 for s in STATUS_FLOW + ["lost"]}
    allp = await db.prospects.find({}, {"_id": 0, "status": 1}).to_list(5000)
    for p in allp:
        counts[p.get("status", "new")] = counts.get(p.get("status", "new"), 0) + 1
    return {"prospects": rows, "counts": counts, "flow": STATUS_FLOW}


@router.get("/prospects/{pid}")
async def get_prospect(pid: str):
    p = await db.prospects.find_one({"id": pid}, NO_ID)
    if not p:
        raise HTTPException(404, "Prospect not found")
    return await _enrich(p)


@router.post("/prospects")
async def create_prospect(body: ProspectIn):
    dup = await _find_dup(body.email, body.mobile)
    if dup:
        raise HTTPException(409, "A prospect with this email or mobile already exists")
    pid = new_id()
    doc = {**body.model_dump(exclude={"consent"}), "id": pid,
           "preferred_name": body.preferred_name or body.first_name,
           "call_mode": "meet", "call_type": "adhoc", "status": "new", "lost_reason": "",
           "client_id": None, "resume_text": "", "suggestions": None,
           "consent": bool(body.consent), "consent_at": now_iso() if body.consent else None,
           "created_at": now_iso(), "updated_at": now_iso()}
    await db.prospects.insert_one(doc)
    await _log(pid, "prospect created in admin", "admin")
    if body.resume_file_id:
        f = await db.files.find_one({"id": body.resume_file_id}, {"_id": 0, "resume_text": 1})
        sug = await ai.parse_resume((f or {}).get("resume_text", ""))
        if sug:
            await db.prospects.update_one({"id": pid}, {"$set": {"suggestions": sug}})
    return await _enrich(await db.prospects.find_one({"id": pid}, NO_ID))


@router.put("/prospects/{pid}")
async def update_prospect(pid: str, body: ProspectIn):
    data = body.model_dump(exclude={"consent"})
    await db.prospects.update_one({"id": pid}, {"$set": {**data, "updated_at": now_iso()}})
    await _log(pid, "details updated", "admin")
    return await _enrich(await db.prospects.find_one({"id": pid}, NO_ID))


@router.post("/prospects/{pid}/status")
async def set_status(pid: str, body: StatusIn):
    if body.status not in STATUS_FLOW + ["lost"]:
        raise HTTPException(400, "Invalid status")
    await db.prospects.update_one({"id": pid}, {"$set": {"status": body.status, "updated_at": now_iso()}})
    await _log(pid, f"status -> {body.status}", "admin")
    return await db.prospects.find_one({"id": pid}, NO_ID)


@router.post("/prospects/{pid}/lost")
async def mark_lost(pid: str, body: LostIn):
    await db.prospects.update_one({"id": pid}, {"$set": {"status": "lost", "lost_reason": body.reason, "updated_at": now_iso()}})
    await _log(pid, "marked lost", "admin", {"reason": body.reason})
    return await db.prospects.find_one({"id": pid}, NO_ID)


@router.post("/prospects/{pid}/parse-resume")
async def reparse(pid: str):
    p = await db.prospects.find_one({"id": pid}, {"_id": 0, "resume_file_id": 1})
    if not p or not p.get("resume_file_id"):
        raise HTTPException(400, "No resume uploaded for this prospect")
    f = await db.files.find_one({"id": p["resume_file_id"]}, {"_id": 0, "resume_text": 1})
    sug = await ai.parse_resume((f or {}).get("resume_text", ""))
    if not sug:
        raise HTTPException(502, "Could not read the resume")
    await db.prospects.update_one({"id": pid}, {"$set": {"suggestions": sug}})
    await _log(pid, "resume re-read by Claude", "admin")
    return sug


@router.delete("/prospects/{pid}")
async def delete_prospect(pid: str):
    await db.prospect_activity.delete_many({"prospect_id": pid})
    await db.time_entries.delete_many({"prospect_id": pid})
    await db.prospects.delete_one({"id": pid})
    return {"ok": True}


@router.get("/prospects-digest")
async def digest():
    today = now_iso()[:10]
    allp = await db.prospects.find({}, NO_ID).to_list(5000)
    new_today = [p for p in allp if p.get("created_at", "")[:10] == today and p.get("status") == "new"]
    booked_today = [p for p in allp if (p.get("call_at") or "")[:10] == today]
    import datetime as _dt
    cutoff = (_dt.datetime.now(_dt.timezone.utc) - _dt.timedelta(days=2)).isoformat()
    stale = [p for p in allp if p.get("status") == "call_done" and p.get("updated_at", "") < cutoff]
    return {"new_prospects": new_today, "calls_today": booked_today, "calls_done_no_cdp": stale}
