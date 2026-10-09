"""Phase F2 — CDP drafting, approval, public plan/proposal, e-sign, Stripe, conversion.
Google Drive is deferred; PDFs are stored in app object storage."""
import os
import io
import json
import logging
from typing import Optional, List, Dict
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel
from core import db, require_admin, new_id, now_iso, put_object, get_object, APP_NAME
from emailer import send_email, _wrap
import ai

logger = logging.getLogger("lms.cdp")
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "")
TERMS_VERSION = "CS-1.0"
NO_ID = {"_id": 0}

admin = APIRouter(prefix="/api/admin", tags=["cdp"], dependencies=[Depends(require_admin)])
public = APIRouter(prefix="/api", tags=["cdp-public"])


# ---------- models ----------
class NotesIn(BaseModel):
    pronoun: str = ""
    education: str = ""
    experience_summary: str = ""
    visa_status: str = ""
    salary_expectation: str = ""
    target_roles: List[Dict] = []
    challenges: str = ""
    goals: str = ""
    winnie_notes: str = ""
    packages: Dict[str, str] = {}


class SectionsIn(BaseModel):
    sections: Dict


class AcceptIn(BaseModel):
    full_name: str
    preferred_name: str = ""
    email: str
    mobile: str = ""
    address: str = ""
    signature: str
    consent: bool = False
    addons: List[str] = []


class CheckoutIn(BaseModel):
    addons: List[str] = []
    origin_url: str


# ---------- helpers ----------
async def _get_by_token(token: str):
    p = await db.prospects.find_one({"plan_token": token}, NO_ID)
    if not p:
        raise HTTPException(404, "Plan not found")
    return p


async def _quote(prospect: dict, addon_keys: List[str]):
    notes = prospect.get("cdp_notes") or {}
    sel = notes.get("packages") or {}
    pkgs = {p["key"]: p for p in await db.service_packages.find({}, NO_ID).to_list(200)}
    lines = []
    for key, role in sel.items():
        included = role == "recommended" or (role == "optional" and key in addon_keys)
        p = pkgs.get(key)
        if not p:
            continue
        price = p.get("price_cents", 0)
        if p.get("gst_treatment") == "ex_gst":
            gst = round(price * 0.1)
            inc, ex = price + gst, price
        else:
            inc, ex = price, round(price / 1.1)
            gst = inc - ex
        lines.append({"key": key, "name": p["name"], "description": p.get("description", ""),
                      "inclusions": p.get("inclusions", []), "ex_cents": ex, "gst_cents": gst, "inc_cents": inc,
                      "role": role, "optional": role == "optional", "included": included,
                      "hours_included": p.get("hours_included")})
    total = sum(l["inc_cents"] for l in lines if l["included"])
    gst_total = sum(l["gst_cents"] for l in lines if l["included"])
    return lines, total, gst_total


def _cdp_pdf(prospect: dict, sections: dict) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table as RLTable, TableStyle
    NAVY = colors.HexColor("#0A192F")
    styles = getSampleStyleSheet()
    h = ParagraphStyle("h", parent=styles["Heading2"], textColor=NAVY, spaceBefore=12)
    body = ParagraphStyle("b", parent=styles["Normal"], fontSize=10, leading=15)
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, title="Career Development Plan", leftMargin=20 * mm, rightMargin=20 * mm, topMargin=20 * mm)
    name = f'{prospect.get("first_name", "")} {prospect.get("last_name", "")}'.strip()
    el = [Paragraph("Career Development Plan", styles["Title"]),
          Paragraph(f'Prepared for {name} by Winnie Hou, Better Careers · {now_iso()[:10]}', body), Spacer(1, 8)]

    def lst(title, items):
        el.append(Paragraph(title, h))
        for it in (items or []):
            el.append(Paragraph("• " + str(it), body))

    def para(title, text):
        el.append(Paragraph(title, h))
        for p in str(text or "").split("\n"):
            if p.strip():
                el.append(Paragraph(p, body))

    lst("What We Heard — Current Situation", sections.get("current_situation"))
    lst("Current Challenges", sections.get("current_challenges"))
    para("Background", sections.get("background"))
    para("Career Recommendation", sections.get("career_recommendation"))
    lst("Goals", sections.get("goals"))
    lst("Development Focus", sections.get("development_focus"))
    lst("Support Approach (Winnie's Role)", sections.get("support_approach"))
    lst("Anticipated Milestones", sections.get("short_term_milestones"))
    mt = sections.get("milestone_table") or []
    if mt:
        rows = [["Timeframe", "Action"]] + [[m.get("timeframe", ""), m.get("action", "")] for m in mt]
        t = RLTable(rows, colWidths=[35 * mm, 125 * mm])
        t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), NAVY), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                               ("FONTSIZE", (0, 0), (-1, -1), 9), ("VALIGN", (0, 0), (-1, -1), "TOP"),
                               ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.lightgrey)]))
        el.append(Spacer(1, 6))
        el.append(t)
    tr = sections.get("target_roles") or []
    if tr:
        rows = [["Role", "Industry", "Approach"]] + [[r.get("role", ""), r.get("industry", ""), r.get("approach", "")] for r in tr]
        t = RLTable(rows, colWidths=[40 * mm, 40 * mm, 80 * mm])
        t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), NAVY), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                               ("FONTSIZE", (0, 0), (-1, -1), 9), ("VALIGN", (0, 0), (-1, -1), "TOP"),
                               ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.lightgrey)]))
        el.append(Paragraph("Target Roles and Approach", h))
        el.append(t)
    doc.build(el)
    buf.seek(0)
    return buf.read()


async def _store_pdf(prospect: dict, sections: dict, label: str) -> str:
    data = _cdp_pdf(prospect, sections)
    fid = new_id()
    path = f"{APP_NAME}/prospect/{fid}.pdf"
    result = put_object(path, data, "application/pdf")
    await db.files.insert_one({"id": fid, "storage_path": result["path"],
                               "original_filename": f'{prospect.get("first_name","")}-{label}.pdf',
                               "content_type": "application/pdf", "scope": "cdp", "is_deleted": False, "created_at": now_iso()})
    return fid


# ---------- admin ----------
@admin.put("/prospects/{pid}/cdp-notes")
async def save_notes(pid: str, body: NotesIn):
    await db.prospects.update_one({"id": pid}, {"$set": {"cdp_notes": body.model_dump(), "updated_at": now_iso()}})
    return {"ok": True}


@admin.post("/prospects/{pid}/cdp-draft")
async def draft(pid: str):
    p = await db.prospects.find_one({"id": pid}, NO_ID)
    if not p:
        raise HTTPException(404, "Prospect not found")
    notes = p.get("cdp_notes") or {}
    if not notes.get("winnie_notes"):
        raise HTTPException(400, "Add your call notes first")
    if not any(v == "recommended" for v in (notes.get("packages") or {}).values()):
        raise HTTPException(400, "Mark at least one package as Recommended")
    resume_text = ""
    if p.get("resume_file_id"):
        f = await db.files.find_one({"id": p["resume_file_id"]}, {"_id": 0, "resume_text": 1})
        resume_text = (f or {}).get("resume_text", "")
    sections = await ai.draft_cdp(notes, resume_text)
    if not sections:
        raise HTTPException(502, "Claude could not draft the CDP, please try again")
    await db.prospects.update_one({"id": pid}, {"$set": {"cdp_sections": sections, "status": "cdp_review", "updated_at": now_iso()}})
    await db.prospect_activity.insert_one({"id": new_id(), "prospect_id": pid, "action": "CDP drafted by Claude", "by": "system", "meta": {}, "at": now_iso()})
    return sections


@admin.put("/prospects/{pid}/cdp-sections")
async def save_sections(pid: str, body: SectionsIn):
    await db.prospects.update_one({"id": pid}, {"$set": {"cdp_sections": body.sections, "updated_at": now_iso()}})
    return {"ok": True}


@admin.post("/prospects/{pid}/cdp-approve")
async def approve(pid: str):
    p = await db.prospects.find_one({"id": pid}, NO_ID)
    if not p or not p.get("cdp_sections"):
        raise HTTPException(400, "Draft the CDP before approving")
    fid = await _store_pdf(p, p["cdp_sections"], "CDP")
    token = p.get("plan_token") or new_id().replace("-", "")
    versions = p.get("plan_versions", []) + [{"file_id": fid, "at": now_iso()}]
    await db.prospects.update_one({"id": pid}, {"$set": {
        "plan_token": token, "plan_file_id": fid, "plan_versions": versions,
        "status": "plan_sent", "cdp_approved_at": now_iso(), "updated_at": now_iso()}})
    await db.prospect_activity.insert_one({"id": new_id(), "prospect_id": pid, "action": "CDP approved & plan link created", "by": "admin", "meta": {}, "at": now_iso()})
    return {"plan_token": token,
            "wechat_message": f'Hi {p.get("preferred_name") or p.get("first_name")}, here is your Career Development Plan: {{link}}'}


# ---------- public plan ----------
@public.get("/plan/{token}")
async def plan(token: str):
    p = await _get_by_token(token)
    if p.get("status") in ("plan_sent",):
        await db.prospects.update_one({"id": p["id"]}, {"$set": {"status": "plan_viewed", "updated_at": now_iso()}})
        await db.prospect_activity.insert_one({"id": new_id(), "prospect_id": p["id"], "action": "plan viewed by client", "by": "client", "meta": {}, "at": now_iso()})
        if ADMIN_EMAIL:
            try:
                await send_email(to=ADMIN_EMAIL, subject="A client viewed their plan",
                                 html=_wrap("Plan viewed", f'<p>{p.get("first_name")} just opened their Career Development Plan.</p>'))
            except Exception:
                pass
    return {"first_name": p.get("first_name"), "preferred_name": p.get("preferred_name") or p.get("first_name"),
            "sections": p.get("cdp_sections") or {}, "pdf": bool(p.get("plan_file_id")),
            "paid": p.get("status") == "paid"}


@public.get("/plan/{token}/pdf")
async def plan_pdf(token: str):
    p = await _get_by_token(token)
    if not p.get("plan_file_id"):
        raise HTTPException(404, "No PDF")
    rec = await db.files.find_one({"id": p["plan_file_id"]}, NO_ID)
    data, ct = get_object(rec["storage_path"])
    return Response(content=data, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="Career-Development-Plan.pdf"'})


@public.get("/plan/{token}/proposal")
async def proposal(token: str, addons: str = ""):
    p = await _get_by_token(token)
    addon_keys = [a for a in addons.split(",") if a]
    lines, total, gst_total = await _quote(p, addon_keys)
    return {"first_name": p.get("first_name"), "preferred_name": p.get("preferred_name") or p.get("first_name"),
            "lines": lines, "total_cents": total, "gst_cents": gst_total, "terms_version": TERMS_VERSION,
            "accepted": bool(p.get("accepted_at")), "paid": p.get("status") == "paid",
            "details": {"full_name": f'{p.get("first_name","")} {p.get("last_name","")}'.strip(),
                        "preferred_name": p.get("preferred_name") or "", "email": p.get("email", ""), "mobile": p.get("mobile", "")}}


@public.post("/plan/{token}/accept")
async def accept(token: str, body: AcceptIn, request: Request):
    p = await _get_by_token(token)
    if not body.consent:
        raise HTTPException(400, "Please agree to the Terms and Conditions")
    if not body.signature.strip():
        raise HTTPException(400, "Signature is required")
    lines, total, gst_total = await _quote(p, body.addons)
    accepted = {"full_name": body.full_name, "preferred_name": body.preferred_name, "email": body.email,
                "mobile": body.mobile, "address": body.address, "signature": body.signature,
                "signed_at": now_iso(), "ip": request.client.host if request.client else "",
                "user_agent": request.headers.get("user-agent", "")[:200], "terms_version": TERMS_VERSION,
                "quote": {"lines": [l for l in lines if l["included"]], "total_cents": total}}
    await db.prospects.update_one({"id": p["id"]}, {"$set": {
        "first_name": body.full_name.split(" ")[0], "preferred_name": body.preferred_name or p.get("preferred_name"),
        "email": body.email.lower().strip(), "mobile": body.mobile or p.get("mobile"),
        "accepted": accepted, "accepted_at": now_iso(), "status": "accepted", "updated_at": now_iso()}})
    await db.prospect_activity.insert_one({"id": new_id(), "prospect_id": p["id"], "action": "proposal accepted & signed", "by": "client", "meta": {}, "at": now_iso()})
    return {"ok": True}


@public.post("/plan/{token}/checkout")
async def checkout(token: str, body: CheckoutIn):
    p = await _get_by_token(token)
    lines, total, gst_total = await _quote(p, body.addons)
    if total <= 0:
        raise HTTPException(400, "Nothing to pay")
    line_items = [{"quantity": 1, "price_data": {"currency": "aud", "unit_amount": l["inc_cents"],
                                                 "product_data": {"name": l["name"]}}}
                  for l in lines if l["included"]]
    try:
        session = stripe.checkout.Session.create(
            line_items=line_items, mode="payment", customer_email=p.get("email") or None,
            invoice_creation={"enabled": True},
            success_url=f'{body.origin_url}/plan/{token}?paid={{CHECKOUT_SESSION_ID}}',
            cancel_url=f'{body.origin_url}/plan/{token}/proposal',
            metadata={"type": "cdp", "prospect_id": p["id"], "token": token})
    except stripe.error.StripeError as e:
        logger.error(f"CDP checkout error: {e}")
        raise HTTPException(502, f"Payment provider error: {e.user_message or str(e)}")
    return {"url": session.url}


@public.get("/plan/{token}/confirm")
async def confirm(token: str, session_id: str):
    p = await _get_by_token(token)
    if p.get("status") == "paid" and p.get("client_id"):
        return {"status": "paid", "client_id": p["client_id"]}
    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except stripe.error.StripeError:
        raise HTTPException(400, "Could not verify payment")
    if session.get("payment_status") != "paid":
        return {"status": session.get("payment_status", "pending")}
    client_id = await _convert(p, session)
    return {"status": "paid", "client_id": client_id}


async def _convert(prospect: dict, session) -> str:
    pid = prospect["id"]
    accepted = prospect.get("accepted") or {}
    quote = accepted.get("quote") or {}
    lines = quote.get("lines") or []
    pkgs = {p["key"]: p for p in await db.service_packages.find({}, NO_ID).to_list(200)}
    # client
    client_id = new_id()
    await db.coaching_clients.insert_one({
        "id": client_id, "first_name": prospect.get("first_name", ""), "last_name": prospect.get("last_name", ""),
        "email": prospect.get("email", ""), "phone": prospect.get("mobile", ""), "status": "active",
        "linked_user_id": None, "created_at": now_iso()})
    for l in lines:
        pk = pkgs.get(l["key"], {})
        await db.client_engagements.insert_one({
            "id": new_id(), "client_id": client_id, "service_package_key": l["key"],
            "hours_included": pk.get("hours_included"), "start_date": now_iso()[:10], "end_date": None,
            "status": "active", "notes": "", "created_at": now_iso()})
    total = quote.get("total_cents", 0)
    await db.orders.insert_one({
        "id": new_id(), "user_id": None, "email": prospect.get("email", ""), "name": prospect.get("first_name", ""),
        "items": [{"title": l["name"], "unit_amount": l["inc_cents"]} for l in lines],
        "subtotal": total, "discount": 0, "total": total, "currency": "aud", "coupon_code": None,
        "status": "paid", "stripe_session_id": session.get("id"), "terms_version": accepted.get("terms_version"),
        "source": "cdp", "created_at": now_iso(), "updated_at": now_iso(), "paid_at": now_iso()})
    await db.time_entries.update_many({"prospect_id": pid}, {"$set": {"client_id": client_id}})
    await db.prospects.update_one({"id": pid}, {"$set": {"client_id": client_id, "status": "paid", "updated_at": now_iso()}})
    await db.prospect_activity.insert_one({"id": new_id(), "prospect_id": pid, "action": "paid — converted to client", "by": "system", "meta": {}, "at": now_iso()})
    if ADMIN_EMAIL:
        try:
            await send_email(to=ADMIN_EMAIL, subject=f'New client: {prospect.get("first_name")} paid A${total/100:,.0f}',
                             html=_wrap("New client", f'<p>{prospect.get("first_name")} {prospect.get("last_name")} has paid and is now a client.</p>'))
        except Exception:
            pass
    return client_id
