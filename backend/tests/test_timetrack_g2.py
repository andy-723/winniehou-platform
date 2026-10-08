"""Prompt G2: additional tests for package-required create_client, auto-engagement,
filters (category, billable), and profitability endpoint."""
import os
from datetime import datetime, timedelta, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or "http://localhost:8001"
ADMIN = {"email": "andrew.phan723@gmail.com", "password": "WinnieAdmin2026!"}


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=20)
    assert r.status_code == 200, r.text
    s.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})
    return s


@pytest.fixture(scope="module")
def state():
    return {"client_id": None, "engagement_id": None, "entries": []}


# ---------- create_client package enforcement ----------
def test_create_client_without_package_rejected(admin):
    r = admin.post(f"{BASE_URL}/api/admin/clients",
                   json={"first_name": "TEST_NoPkg", "last_name": "X", "email": "nopkg@test.com"},
                   timeout=15)
    assert r.status_code == 400, r.text
    assert "package" in r.text.lower()


def test_create_client_with_package_auto_engagement(admin, state):
    r = admin.post(f"{BASE_URL}/api/admin/clients",
                   json={"first_name": "TEST_G2", "last_name": "Pkg",
                         "email": "test_g2@example.com",
                         "service_package_key": "career-coaching-essentials"},
                   timeout=15)
    assert r.status_code == 200, r.text
    c = r.json()
    assert c["first_name"] == "TEST_G2"
    assert "_id" not in c
    state["client_id"] = c["id"]

    # verify engagement was auto-created
    g = admin.get(f"{BASE_URL}/api/admin/clients/{c['id']}", timeout=15)
    assert g.status_code == 200
    engs = g.json().get("engagements", [])
    assert len(engs) == 1, f"expected 1 auto-engagement, got {len(engs)}"
    assert engs[0]["service_package_key"] == "career-coaching-essentials"
    assert engs[0]["status"] == "active"
    state["engagement_id"] = engs[0]["id"]


def test_create_client_unknown_package_rejected(admin):
    r = admin.post(f"{BASE_URL}/api/admin/clients",
                   json={"first_name": "TEST_Bad", "last_name": "Pkg",
                         "service_package_key": "not-a-real-package"},
                   timeout=15)
    assert r.status_code == 400


# ---------- entries + filters ----------
def _mk_entry(admin, state, category, billable, minutes=30):
    now = datetime.now(timezone.utc)
    body = {
        "subject_type": "client",
        "client_id": state["client_id"],
        "engagement_id": state["engagement_id"],
        "category": category,
        "billable": billable,
        "description": f"TEST_g2_{category}",
        "started_at": (now - timedelta(minutes=minutes)).isoformat(),
        "ended_at": now.isoformat(),
    }
    r = admin.post(f"{BASE_URL}/api/admin/time/entries", json=body, timeout=15)
    assert r.status_code == 200, r.text
    state["entries"].append(r.json()["id"])
    return r.json()


def test_entries_filters_category_and_billable(admin, state):
    e1 = _mk_entry(admin, state, "Coaching call", True, 60)
    e2 = _mk_entry(admin, state, "Email", False, 20)
    # duration_minutes computed server side
    assert e1["duration_minutes"] == 60
    assert e2["duration_minutes"] == 20

    # Filter: category
    r = admin.get(f"{BASE_URL}/api/admin/time/entries?category=Coaching call", timeout=15)
    assert r.status_code == 200
    ids = [x["id"] for x in r.json()]
    assert e1["id"] in ids
    assert e2["id"] not in ids

    # Filter: billable=true
    r = admin.get(f"{BASE_URL}/api/admin/time/entries?billable=true&client_id={state['client_id']}", timeout=15)
    assert r.status_code == 200
    assert all(x.get("billable") is True for x in r.json())

    # Filter: billable=false
    r = admin.get(f"{BASE_URL}/api/admin/time/entries?billable=false&client_id={state['client_id']}", timeout=15)
    assert r.status_code == 200
    assert all(x.get("billable") is False for x in r.json())


def test_update_entry_recomputes_duration(admin, state):
    eid = state["entries"][0]
    now = datetime.now(timezone.utc)
    body = {
        "subject_type": "client",
        "client_id": state["client_id"],
        "engagement_id": state["engagement_id"],
        "category": "Coaching call",
        "billable": True,
        "description": "TEST_updated",
        "started_at": (now - timedelta(minutes=120)).isoformat(),
        "ended_at": now.isoformat(),
    }
    r = admin.put(f"{BASE_URL}/api/admin/time/entries/{eid}", json=body, timeout=15)
    assert r.status_code == 200
    assert r.json()["duration_minutes"] == 120
    assert r.json()["description"] == "TEST_updated"
    assert "_id" not in r.json()


# ---------- profitability ----------
def test_profitability_endpoint(admin, state):
    r = admin.get(f"{BASE_URL}/api/admin/time/profitability", timeout=15)
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list)
    # find our engagement
    ours = next((x for x in rows if x.get("engagement_id") == state["engagement_id"]), None)
    assert ours, "profitability missing our engagement"
    for k in ("engagement_id", "client", "package", "price_cents", "hours", "rate"):
        assert k in ours
    # we logged 120 + 20 = 140 min = ~2.33h
    assert ours["hours"] >= 2.0
    if ours["price_cents"] and ours["hours"] > 0:
        expected = round((ours["price_cents"] / 100) / ours["hours"], 2)
        assert ours["rate"] == expected


# ---------- cleanup ----------
def test_zzz_cleanup(admin, state):
    for eid in state["entries"]:
        admin.delete(f"{BASE_URL}/api/admin/time/entries/{eid}", timeout=15)
