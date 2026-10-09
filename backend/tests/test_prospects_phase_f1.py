"""Phase F1 CORE — Prospects + services pricing + timetrack prospect tab."""
import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://english-pro-academy-1.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "andrew.phan723@gmail.com"
ADMIN_PASS = "WinnieAdmin2026!"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    tok = r.json().get("access_token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


# ---------------- Services pricing ----------------
def test_services_pricing():
    r = requests.get(f"{BASE}/api/services")
    assert r.status_code == 200, r.text
    data = r.json()
    pkgs = data if isinstance(data, list) else data.get("services") or data.get("packages") or []
    assert len(pkgs) == 3, f"Expected 3 services, got {len(pkgs)}: {[p.get('title') or p.get('name') for p in pkgs]}"
    prices = sorted([p.get("price_cents") for p in pkgs])
    assert prices == [210000, 210000, 385000], f"Prices mismatch: {prices}"
    for p in pkgs:
        name = (p.get("title") or p.get("name") or "").lower()
        assert "bundle" not in name and "ui-test" not in name and "ui test" not in name


# ---------------- Public intake ----------------
def test_intake_submit_wechat_fallback():
    r = requests.post(f"{BASE}/api/intake/submit", json={
        "first_name": "TESTF1", "last_name": "Prospect",
        "mobile": "+61400000199", "email": "testf1_prospect@example.com",
        "send_resume_later": True, "call_mode": "meet",
        "call_type": "booked", "source": "wechat", "consent": True,
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("ok") is True
    assert body.get("prospect_id")
    # WeChat fallback expected since Google calendar not connected
    assert body.get("calendar_connected") in (False, None)
    assert "wechat" in (body.get("message") or "").lower()
    return body["prospect_id"]


def test_intake_adhoc_message():
    r = requests.post(f"{BASE}/api/intake/submit", json={
        "first_name": "TESTF1Adhoc", "mobile": "+61400000198",
        "email": "testf1_adhoc@example.com", "call_type": "adhoc",
        "source": "wechat", "consent": True,
    })
    assert r.status_code == 200, r.text
    assert "shortly" in r.json().get("message", "").lower() or "call you" in r.json().get("message", "").lower()


def test_intake_requires_consent():
    r = requests.post(f"{BASE}/api/intake/submit", json={
        "first_name": "NoConsent", "email": "noc@example.com", "consent": False,
    })
    assert r.status_code == 400


# ---------------- Admin prospects ----------------
def test_admin_prospects_list(admin_session):
    r = admin_session.get(f"{BASE}/api/admin/prospects")
    assert r.status_code == 200, r.text
    data = r.json()
    assert "prospects" in data and "counts" in data and "flow" in data
    assert data["flow"][0] == "new"


def test_admin_create_status_lost_and_cleanup(admin_session):
    # Create
    r = admin_session.post(f"{BASE}/api/admin/prospects", json={
        "first_name": "TESTF1Admin", "last_name": "Create",
        "email": "testf1_admin@example.com", "mobile": "+61400000197",
        "source": "wechat", "consent": True,
    })
    assert r.status_code == 200, r.text
    pid = r.json()["id"]

    # Detail
    r2 = admin_session.get(f"{BASE}/api/admin/prospects/{pid}")
    assert r2.status_code == 200
    assert "activity" in r2.json()

    # Status update
    r3 = admin_session.post(f"{BASE}/api/admin/prospects/{pid}/status", json={"status": "call_booked"})
    assert r3.status_code == 200
    assert r3.json()["status"] == "call_booked"

    # Update
    r4 = admin_session.put(f"{BASE}/api/admin/prospects/{pid}", json={
        "first_name": "TESTF1Admin", "last_name": "Updated",
        "email": "testf1_admin@example.com", "mobile": "+61400000197",
        "source": "wechat", "consent": True,
    })
    assert r4.status_code == 200
    assert r4.json()["last_name"] == "Updated"

    # Lost
    r5 = admin_session.post(f"{BASE}/api/admin/prospects/{pid}/lost", json={"reason": "test"})
    assert r5.status_code == 200
    assert r5.json()["status"] == "lost"


# ---------------- Timetrack prospect tab ----------------
def test_timetrack_prospect_support(admin_session):
    r = admin_session.get(f"{BASE}/api/admin/time/entries", params={"subject_type": "prospect"})
    assert r.status_code == 200, r.text


# ---------------- Cleanup ----------------
def test_cleanup(admin_session):
    r = admin_session.get(f"{BASE}/api/admin/prospects", params={"q": "TESTF1"})
    if r.status_code == 200:
        for p in r.json().get("prospects", []):
            # best effort: no delete endpoint; mark lost so they're filtered
            try:
                admin_session.post(f"{BASE}/api/admin/prospects/{p['id']}/lost", json={"reason": "test-cleanup"})
            except Exception:
                pass
