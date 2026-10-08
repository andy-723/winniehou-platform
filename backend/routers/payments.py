import os
import logging
from typing import List, Optional
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from core import db, get_current_user, new_id, now_iso
from emailer import send_receipt

logger = logging.getLogger("lms.payments")
router = APIRouter(prefix="/api", tags=["payments"])

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
tax_mode = "full"

TAX_CODES = {"course": "txcd_10302000", "product": "txcd_10000000"}


class CartItem(BaseModel):
    type: str = Field(pattern="^(course|product)$")
    id: str


class CheckoutIn(BaseModel):
    items: List[CartItem]
    coupon_code: Optional[str] = None
    origin_url: str
    terms_version: Optional[str] = None


async def resolve_items(items: List[CartItem], user_id: str) -> list:
    out, seen = [], set()
    for it in items:
        key = (it.type, it.id)
        if key in seen:
            continue
        seen.add(key)
        if it.type == "course":
            c = await db.courses.find_one({"id": it.id, "published": True}, {"_id": 0})
            if not c:
                raise HTTPException(404, f"Course not found: {it.id}")
            if await db.enrollments.find_one({"user_id": user_id, "course_id": c["id"], "active": True}):
                raise HTTPException(400, f"You already own '{c['title']}'")
            out.append({"type": "course", "id": c["id"], "title": c["title"], "unit_amount": int(c["price"]),
                        "image": c.get("thumbnail_url", "")})
        else:
            p = await db.products.find_one({"id": it.id, "active": True}, {"_id": 0})
            if not p:
                raise HTTPException(404, f"Product not found: {it.id}")
            out.append({"type": "product", "id": p["id"], "title": p["title"], "unit_amount": int(p["price"]),
                        "image": p.get("image_url", "")})
    if not out:
        raise HTTPException(400, "Cart is empty")
    return out


async def apply_coupon(code: Optional[str], subtotal: int) -> tuple:
    if not code:
        return None, 0
    coupon = await db.coupons.find_one({"code": code.strip().upper(), "active": True}, {"_id": 0})
    if not coupon:
        raise HTTPException(400, "Invalid coupon code")
    if coupon.get("expires_at") and coupon["expires_at"] < now_iso():
        raise HTTPException(400, "This coupon has expired")
    if coupon.get("max_uses") and coupon.get("uses", 0) >= coupon["max_uses"]:
        raise HTTPException(400, "This coupon has reached its usage limit")
    if coupon["kind"] == "percent":
        discount = round(subtotal * coupon["value"] / 100)
    else:
        discount = min(int(coupon["value"]), subtotal)
    return coupon, discount


@router.post("/payments/validate-coupon")
async def validate_coupon(body: CheckoutIn, user: dict = Depends(get_current_user)):
    items = await resolve_items(body.items, user["id"])
    subtotal = sum(i["unit_amount"] for i in items)
    coupon, discount = await apply_coupon(body.coupon_code, subtotal)
    return {"subtotal": subtotal, "discount": discount, "total": subtotal - discount,
            "coupon": {"code": coupon["code"], "kind": coupon["kind"], "value": coupon["value"]} if coupon else None}


@router.post("/payments/checkout")
async def create_checkout(body: CheckoutIn, user: dict = Depends(get_current_user)):
    items = await resolve_items(body.items, user["id"])
    subtotal = sum(i["unit_amount"] for i in items)
    coupon, discount = await apply_coupon(body.coupon_code, subtotal)
    total = subtotal - discount
    order_id = new_id()
    line_items = []
    for i in items:
        amount = i["unit_amount"]
        if discount and subtotal:
            amount = max(0, round(i["unit_amount"] - discount * i["unit_amount"] / subtotal))
        i["charged_amount"] = amount
        product_data = {"name": i["title"], "tax_code": TAX_CODES[i["type"]]}
        if i["image"] and i["image"].startswith("https://"):
            product_data["images"] = [i["image"]]
        line_items.append({"quantity": 1, "price_data": {"currency": "usd", "unit_amount": amount,
                                                         "product_data": product_data}})
    if total == 0:
        await db.orders.insert_one(_order_doc(order_id, user, items, subtotal, discount, total, coupon, None, body.terms_version))
        await fulfill_order(order_id, body.origin_url)
        return {"checkout_url": f"{body.origin_url}/payment/success?order_id={order_id}", "session_id": None,
                "order_id": order_id}
    kwargs = dict(line_items=line_items, mode="payment", customer_email=user["email"],
                  success_url=f"{body.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
                  cancel_url=f"{body.origin_url}/payment/cancel",
                  metadata={"user_id": user["id"], "order_id": order_id})
    try:
        if tax_mode == "full":
            try:
                session = stripe.checkout.Session.create(**kwargs, managed_payments={"enabled": True})
            except stripe.error.InvalidRequestError as e:
                msg = (e.user_message or str(e)).lower()
                if "managed payments" in msg or "ineligible" in msg or "managed_payments" in msg:
                    session = stripe.checkout.Session.create(**kwargs, automatic_tax={"enabled": True},
                                                             billing_address_collection="required")
                else:
                    raise
        else:
            session = stripe.checkout.Session.create(**kwargs)
    except stripe.error.StripeError as e:
        logger.error(f"Stripe checkout error: {e}")
        raise HTTPException(502, f"Payment provider error: {e.user_message or str(e)}")
    await db.orders.insert_one(_order_doc(order_id, user, items, subtotal, discount, total, coupon, session.id, body.terms_version))
    await db.payment_transactions.insert_one({
        "session_id": session.id, "order_id": order_id, "user_id": user["id"], "amount": total, "currency": "usd",
        "status": "initiated", "payment_status": "pending", "created_at": now_iso(), "updated_at": now_iso()})
    return {"checkout_url": session.url, "session_id": session.id, "order_id": order_id}


def _order_doc(order_id, user, items, subtotal, discount, total, coupon, session_id, terms_version=None):
    return {"id": order_id, "user_id": user["id"], "email": user["email"], "name": user.get("name", ""),
            "items": items, "subtotal": subtotal, "discount": discount, "total": total, "currency": "usd",
            "coupon_code": coupon["code"] if coupon else None, "status": "pending" if total else "paid",
            "stripe_session_id": session_id, "stripe_payment_intent_id": None, "receipt_url": None,
            "terms_version": terms_version,
            "created_at": now_iso(), "updated_at": now_iso(), "paid_at": now_iso() if not total else None}


async def fulfill_order(order_id: str, app_url: str = ""):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order or order.get("fulfilled"):
        return
    for i in order["items"]:
        if i["type"] == "course":
            await db.enrollments.update_one(
                {"user_id": order["user_id"], "course_id": i["id"]},
                {"$set": {"active": True, "order_id": order_id, "updated_at": now_iso()},
                 "$setOnInsert": {"id": new_id(), "created_at": now_iso()}}, upsert=True)
        else:
            await db.product_access.update_one(
                {"user_id": order["user_id"], "product_id": i["id"]},
                {"$set": {"active": True, "order_id": order_id}, "$setOnInsert": {"id": new_id(), "created_at": now_iso()}},
                upsert=True)
    if order.get("coupon_code"):
        await db.coupons.update_one({"code": order["coupon_code"]}, {"$inc": {"uses": 1}})
    await db.orders.update_one({"id": order_id}, {"$set": {"fulfilled": True, "status": "paid",
                                                           "paid_at": order.get("paid_at") or now_iso()}})
    if app_url:
        try:
            await send_receipt(order["email"], order.get("name", ""), order, app_url)
        except Exception as e:
            logger.error(f"Receipt email failed: {e}")


async def mark_paid(session_id: str, session_obj=None, app_url: str = ""):
    tx = await db.payment_transactions.find_one({"session_id": session_id})
    if not tx:
        return None
    if tx.get("payment_status") == "paid":
        return tx
    pi_id = (session_obj or {}).get("payment_intent") if isinstance(session_obj, dict) else getattr(session_obj, "payment_intent", None)
    receipt_url = None
    if pi_id:
        try:
            pi = stripe.PaymentIntent.retrieve(pi_id, expand=["latest_charge"])
            receipt_url = pi.latest_charge.receipt_url if pi.latest_charge else None
        except stripe.error.StripeError:
            pass
    res = await db.payment_transactions.update_one(
        {"session_id": session_id, "payment_status": {"$ne": "paid"}},
        {"$set": {"status": "completed", "payment_status": "paid", "stripe_payment_intent_id": pi_id,
                  "updated_at": now_iso()}})
    if res.modified_count:
        await db.orders.update_one({"id": tx["order_id"]}, {"$set": {
            "status": "paid", "stripe_payment_intent_id": pi_id, "receipt_url": receipt_url,
            "paid_at": now_iso(), "updated_at": now_iso()}})
        await fulfill_order(tx["order_id"], app_url)
    return await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})


@router.get("/payments/status/{session_id}")
async def payment_status(session_id: str, request: Request):
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx:
        raise HTTPException(404, "Transaction not found")
    if tx.get("payment_status") != "paid":
        try:
            s = stripe.checkout.Session.retrieve(session_id)
            if s.payment_status == "paid" or s.status == "complete":
                origin = request.headers.get("origin", "")
                tx = await mark_paid(session_id, s, origin)
        except stripe.error.StripeError:
            pass
    return {"session_id": tx["session_id"], "status": tx["status"], "payment_status": tx["payment_status"],
            "order_id": tx.get("order_id")}


@router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except (stripe.error.SignatureVerificationError, ValueError):
        raise HTTPException(400, "Invalid signature")
    obj, t = event["data"]["object"], event["type"]
    if t in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        if obj.get("payment_status") == "paid" or t.endswith("succeeded"):
            await mark_paid(obj["id"], obj)
    elif t == "checkout.session.async_payment_failed":
        await db.payment_transactions.update_one({"session_id": obj["id"]}, {"$set": {
            "status": "failed", "payment_status": "failed", "updated_at": now_iso()}})
        await db.orders.update_one({"stripe_session_id": obj["id"]}, {"$set": {"status": "failed"}})
    elif t == "checkout.session.expired":
        await db.payment_transactions.update_one({"session_id": obj["id"]}, {"$set": {
            "status": "expired", "payment_status": "expired", "updated_at": now_iso()}})
        await db.orders.update_one({"stripe_session_id": obj["id"]}, {"$set": {"status": "expired"}})
    elif t == "charge.refunded":
        await db.payment_transactions.update_one({"stripe_payment_intent_id": obj.get("payment_intent")}, {"$set": {
            "status": "refunded", "payment_status": "refunded", "updated_at": now_iso()}})
    return {"status": "ok"}


@router.get("/me/orders")
async def my_orders(user: dict = Depends(get_current_user)):
    return await db.orders.find({"user_id": user["id"], "status": {"$in": ["paid", "refunded"]}}, {"_id": 0}) \
        .sort("created_at", -1).to_list(200)


@router.get("/me/orders/{order_id}")
async def my_order(order_id: str, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    return order


@router.get("/me/products")
async def my_products(user: dict = Depends(get_current_user)):
    access = await db.product_access.find({"user_id": user["id"], "active": True}, {"_id": 0}).to_list(200)
    out = []
    for a in access:
        p = await db.products.find_one({"id": a["product_id"]}, {"_id": 0})
        if p:
            out.append(p)
    return out
