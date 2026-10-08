import os
import re
import ipaddress
import logging
import httpx
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

logger = logging.getLogger("lms.email")

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ["EMAIL_FROM_NAME"]
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str) -> str | None:
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if EMAIL_REPLY_TO:
        payload["contact_email"] = EMAIL_REPLY_TO
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{EMAIL_BASE_URL}/api/v1/email/send",
                                     headers={"X-Email-Key": EMAIL_KEY}, json=payload)
        resp.raise_for_status()
        return resp.json().get("id")
    except Exception as e:
        logger.error(f"Email send failed: {e}")
        return None


def _wrap(title: str, inner: str) -> str:
    return (f'<table role="presentation" width="100%" style="background:#FAFAF7;padding:32px 0">'
            f'<tr><td align="center"><table role="presentation" width="560" style="background:#ffffff;'
            f'border:1px solid #E2E8F0;border-radius:12px;font-family:Georgia,serif;color:#1E293B">'
            f'<tr><td style="background:#0A192F;padding:24px 32px;color:#D4AF37;font-size:20px;letter-spacing:2px">'
            f'{escape(EMAIL_FROM_NAME.upper())}</td></tr>'
            f'<tr><td style="padding:32px;font-family:Arial,sans-serif;font-size:15px;line-height:1.6">'
            f'<h2 style="font-family:Georgia,serif;margin:0 0 16px;color:#0A192F">{escape(title)}</h2>{inner}'
            f'<p style="font-size:12px;color:#888;margin-top:32px">Sent by {escape(EMAIL_FROM_NAME)}. '
            f'We never ask for your password or card details by email.</p></td></tr></table></td></tr></table>')


async def send_receipt(to: str, name: str, order: dict, app_url: str):
    rows = "".join(f'<tr><td style="padding:6px 0">{escape(i["title"])}</td>'
                   f'<td align="right">${i["unit_amount"] / 100:.2f}</td></tr>' for i in order["items"])
    inner = (f'<p>Hi {escape(name or "there")}, thank you for your purchase.</p>'
             f'<table width="100%" style="border-top:1px solid #eee;border-bottom:1px solid #eee;margin:16px 0">{rows}'
             f'<tr><td style="padding:10px 0;font-weight:bold">Total</td>'
             f'<td align="right" style="font-weight:bold">${order["total"] / 100:.2f} {order["currency"].upper()}</td></tr></table>'
             f'<p>Order reference: <strong>{escape(order["id"][:8].upper())}</strong></p>'
             f'<p><a href="{escape(app_url)}/dashboard" style="background:#D4AF37;color:#0A192F;padding:12px 20px;'
             f'border-radius:8px;text-decoration:none;font-weight:bold">Open your dashboard</a></p>')
    await send_email(to=to, subject=f"Your {EMAIL_FROM_NAME} receipt", html=_wrap("Payment received", inner))


async def send_password_reset(to: str, reset_url: str):
    inner = (f'<p>We received a request to reset your password. This link expires in 1 hour.</p>'
             f'<p><a href="{escape(reset_url)}" style="background:#0A192F;color:#fff;padding:12px 20px;'
             f'border-radius:8px;text-decoration:none">Reset my password</a></p>'
             f'<p>If you did not request this, you can safely ignore this email.</p>')
    await send_email(to=to, subject=f"Reset your {EMAIL_FROM_NAME} password", html=_wrap("Password reset", inner))
