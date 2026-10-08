from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
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


# ---------- rich reports (Toggl-style) + exports ----------
async def _report_data(date_from=None, date_to=None, subject_type=None):
    rows = await list_entries(subject_type=subject_type, date_from=date_from, date_to=date_to)
    clients = {c["id"]: c for c in await db.coaching_clients.find({}, NO_ID).to_list(2000)}
    users = {u["id"]: u for u in await db.users.find({}, {"_id": 0, "id": 1, "name": 1, "email": 1}).to_list(5000)}
    pkgs = {p["key"]: p for p in await db.service_packages.find({}, NO_ID).to_list(200)}
    engs = await db.client_engagements.find({}, NO_ID).to_list(2000)
    client_engs = {}
    for e in engs:
        client_engs.setdefault(e["client_id"], []).append(e)

    def cname(cid):
        c = clients.get(cid)
        return (f'{c["first_name"]} {c.get("last_name", "")}'.strip() if c else "Client")

    def sname(sid):
        u = users.get(sid)
        return (u["name"] if u else "Student")

    total = bill = nonbill = 0
    daily = {}
    by_client = {}
    by_student = {}
    detailed = []
    for r in rows:
        m = r.get("duration_minutes", 0)
        st = r.get("subject_type", "internal")
        is_b = bool(r.get("billable"))
        total += m
        bill += m if is_b else 0
        nonbill += 0 if is_b else m
        d = (r.get("started_at") or "")[:10]
        slot = daily.setdefault(d, {"date": d, "billable": 0, "non_billable": 0})
        slot["billable" if is_b else "non_billable"] += m
        if st == "client":
            cid = r.get("client_id")
            b = by_client.setdefault(cid, {"client_id": cid, "name": cname(cid), "minutes": 0, "billable": 0, "non_billable": 0})
            b["minutes"] += m
            b["billable" if is_b else "non_billable"] += m
            name = cname(cid)
        elif st == "student":
            sid = r.get("student_id")
            s = by_student.setdefault(sid, {"student_id": sid, "name": sname(sid), "minutes": 0, "sessions": 0})
            s["minutes"] += m
            s["sessions"] += 1
            name = sname(sid)
        else:
            name = "Internal"
        detailed.append({
            "date": d, "start": (r.get("started_at") or "")[11:16], "end": (r.get("ended_at") or "")[11:16],
            "subject": st, "name": name, "category": r.get("category") or "", "description": r.get("description") or "",
            "minutes": m, "hours": round(m / 60, 2), "billable": "yes" if is_b else "no",
        })

    client_rows = []
    revenue_cents = 0
    for cid, b in by_client.items():
        price = sum(pkgs.get(e["service_package_key"], {}).get("price_cents", 0) for e in client_engs.get(cid, []))
        pkg_names = ", ".join(pkgs.get(e["service_package_key"], {}).get("name", e["service_package_key"]) for e in client_engs.get(cid, [])) or "—"
        hours = round(b["minutes"] / 60, 2)
        revenue_cents += price
        client_rows.append({
            "client_id": cid, "name": b["name"], "package": pkg_names, "price_cents": price,
            "hours": hours, "billable_hours": round(b["billable"] / 60, 2), "non_billable_hours": round(b["non_billable"] / 60, 2),
            "rate": round((price / 100) / hours, 2) if hours > 0 else None,
        })
    client_rows.sort(key=lambda x: -x["hours"])
    student_rows = sorted(
        [{"student_id": s["student_id"], "name": s["name"], "sessions": s["sessions"], "hours": round(s["minutes"] / 60, 2)} for s in by_student.values()],
        key=lambda x: -x["hours"])

    return {
        "range": {"date_from": date_from, "date_to": date_to, "subject_type": subject_type or "all"},
        "totals": {"total_minutes": total, "billable_minutes": bill, "non_billable_minutes": nonbill,
                   "entries": len(rows), "revenue_cents": revenue_cents,
                   "clients": len(client_rows), "students": len(student_rows)},
        "daily": [daily[k] for k in sorted(daily.keys())],
        "by_client": client_rows,
        "by_student": student_rows,
        "detailed": detailed,
    }


@router.get("/time/reports")
async def reports(date_from: Optional[str] = None, date_to: Optional[str] = None, subject_type: Optional[str] = None):
    return await _report_data(date_from, date_to, subject_type)


@router.get("/time/reports/export")
async def export_report(format: str = "csv", date_from: Optional[str] = None,
                        date_to: Optional[str] = None, subject_type: Optional[str] = None):
    import io
    data = await _report_data(date_from, date_to, subject_type)
    rng = f'{date_from or "start"}_{date_to or "today"}'
    fname = f"better-careers-time-report_{rng}"

    if format == "csv":
        import csv
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["Date", "Start", "End", "Subject", "Name", "Category", "Description", "Hours", "Billable"])
        for r in data["detailed"]:
            w.writerow([r["date"], r["start"], r["end"], r["subject"], r["name"], r["category"], r["description"], r["hours"], r["billable"]])
        return Response(content=buf.getvalue(), media_type="text/csv",
                        headers={"Content-Disposition": f'attachment; filename="{fname}.csv"'})

    if format == "xlsx":
        import pandas as pd
        t = data["totals"]
        summary = pd.DataFrame([
            {"Metric": "Total hours", "Value": round(t["total_minutes"] / 60, 2)},
            {"Metric": "Billable hours", "Value": round(t["billable_minutes"] / 60, 2)},
            {"Metric": "Non-billable hours", "Value": round(t["non_billable_minutes"] / 60, 2)},
            {"Metric": "Package revenue (AUD)", "Value": round(t["revenue_cents"] / 100, 2)},
            {"Metric": "Clients", "Value": t["clients"]},
            {"Metric": "Students", "Value": t["students"]},
        ])
        clients_df = pd.DataFrame([{"Client": r["name"], "Package": r["package"], "Revenue (AUD)": round(r["price_cents"] / 100, 2),
                                    "Hours": r["hours"], "Billable hours": r["billable_hours"], "Effective $/h": r["rate"]} for r in data["by_client"]])
        students_df = pd.DataFrame([{"Student": r["name"], "Reconnect sessions": r["sessions"], "Hours": r["hours"]} for r in data["by_student"]])
        entries_df = pd.DataFrame(data["detailed"])
        buf = io.BytesIO()
        with pd.ExcelWriter(buf, engine="openpyxl") as xl:
            summary.to_excel(xl, sheet_name="Summary", index=False)
            (clients_df if not clients_df.empty else pd.DataFrame([{"Client": "No client time in range"}])).to_excel(xl, sheet_name="Clients", index=False)
            (students_df if not students_df.empty else pd.DataFrame([{"Student": "No student time in range"}])).to_excel(xl, sheet_name="Students", index=False)
            (entries_df if not entries_df.empty else pd.DataFrame([{"Note": "No entries in range"}])).to_excel(xl, sheet_name="Entries", index=False)
        buf.seek(0)
        return Response(content=buf.read(),
                        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        headers={"Content-Disposition": f'attachment; filename="{fname}.xlsx"'})

    if format == "pdf":
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import mm
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table as RLTable, TableStyle
        NAVY = colors.HexColor("#0A192F")
        GOLD = colors.HexColor("#B8860B")
        t = data["totals"]
        styles = getSampleStyleSheet()
        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4, title="Time report", leftMargin=18 * mm, rightMargin=18 * mm, topMargin=18 * mm)
        el = [Paragraph("Better Careers — Time Report", styles["Title"])]
        el.append(Paragraph(f'Range: {date_from or "start"} to {date_to or "today"} · {data["range"]["subject_type"]}', styles["Normal"]))
        el.append(Spacer(1, 8))
        tot = [["Total hours", f'{t["total_minutes"] / 60:.1f}'], ["Billable hours", f'{t["billable_minutes"] / 60:.1f}'],
               ["Non-billable hours", f'{t["non_billable_minutes"] / 60:.1f}'], ["Package revenue", f'A${t["revenue_cents"] / 100:,.0f}'],
               ["Clients", str(t["clients"])], ["Students", str(t["students"])]]
        tt = RLTable(tot, colWidths=[70 * mm, 40 * mm])
        tt.setStyle(TableStyle([("TEXTCOLOR", (0, 0), (0, -1), NAVY), ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                                ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.lightgrey), ("FONTSIZE", (0, 0), (-1, -1), 9)]))
        el.append(tt)
        el.append(Spacer(1, 14))
        el.append(Paragraph("Clients — hours & profitability", styles["Heading2"]))
        crows = [["Client", "Package", "Revenue", "Hours", "Billable", "$/h"]] + [
            [r["name"], r["package"], f'A${r["price_cents"] / 100:,.0f}', f'{r["hours"]:.1f}', f'{r["billable_hours"]:.1f}',
             (f'A${r["rate"]:,.0f}' if r["rate"] is not None else "—")] for r in data["by_client"]]
        if len(crows) == 1:
            crows.append(["No client time in range", "", "", "", "", ""])
        ct = RLTable(crows, colWidths=[38 * mm, 42 * mm, 24 * mm, 18 * mm, 20 * mm, 20 * mm])
        ct.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), NAVY), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                                ("FONTSIZE", (0, 0), (-1, -1), 8), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F3F3EE")]),
                                ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.lightgrey), ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
        el.append(ct)
        el.append(Spacer(1, 14))
        el.append(Paragraph("Students — reconnect sessions", styles["Heading2"]))
        srows = [["Student", "Reconnect sessions", "Hours"]] + [[r["name"], str(r["sessions"]), f'{r["hours"]:.1f}'] for r in data["by_student"]]
        if len(srows) == 1:
            srows.append(["No student time in range", "", ""])
        stt = RLTable(srows, colWidths=[80 * mm, 40 * mm, 30 * mm])
        stt.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), GOLD), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                                 ("FONTSIZE", (0, 0), (-1, -1), 8), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F3F3EE")]),
                                 ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.lightgrey), ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
        el.append(stt)
        doc.build(el)
        buf.seek(0)
        return Response(content=buf.read(), media_type="application/pdf",
                        headers={"Content-Disposition": f'attachment; filename="{fname}.pdf"'})

    raise HTTPException(400, "Unknown format")
