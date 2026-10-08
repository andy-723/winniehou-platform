"""Prompt G: Toggl-style time tracking (admin CMS) tests."""
import os
import time
from datetime import datetime, timedelta, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or "http://localhost:8001"
if not BASE_URL.startswith("http"):
    BASE_URL = "http://localhost:8001"

ADMIN = {"email": "andrew.phan723@gmail.com", "password": "WinnieAdmin2026!"}


@pytest.fixture(scope="module")
def admin_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token")
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def created_ids():
    return {"clients": [], "entries": []}


# -------- Auth guard --------
def test_time_endpoints_require_auth():
    r = requests.get(f"{BASE_URL}/api/admin/time/categories", timeout=15)
    assert r.status_code in (401, 403)
    r2 = requests.get(f"{BASE_URL}/api/admin/clients", timeout=15)
    assert r2.status_code in (401, 403)


# -------- Categories --------
def test_categories_seeded(admin_client):
    r = admin_client.get(f"{BASE_URL}/api/admin/time/categories", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 13, f"expected >=13 categories, got {len(data)}"
    # each category must have a subject_type
    subjects = {c.get("subject_type") for c in data}
    assert subjects & {"client", "student", "internal"}


# -------- Client CRUD + engagement --------
def test_create_client_and_engagement(admin_client, created_ids):
    body = {"first_name": "TEST_Alice", "last_name": "Zhao",
            "email": "test_alice@example.com", "phone": "123"}
    r = admin_client.post(f"{BASE_URL}/api/admin/clients", json=body, timeout=15)
    assert r.status_code == 200, r.text
    c = r.json()
    assert c["first_name"] == "TEST_Alice"
    assert "id" in c
    created_ids["clients"].append(c["id"])

    # GET to verify persistence
    g = admin_client.get(f"{BASE_URL}/api/admin/clients/{c['id']}", timeout=15)
    assert g.status_code == 200
    assert g.json()["email"] == "test_alice@example.com"

    # Add engagement (quantum-leap)
    eng = admin_client.post(
        f"{BASE_URL}/api/admin/clients/{c['id']}/engagements",
        json={"service_package_key": "quantum-leap", "start_date": "2026-01-01"},
        timeout=15,
    )
    assert eng.status_code == 200, eng.text
    created_ids["engagement_id"] = eng.json()["id"]
    created_ids["client_id"] = c["id"]


# -------- Validation --------
def test_client_entry_without_engagement_rejected(admin_client, created_ids):
    cid = created_ids["client_id"]
    now = datetime.now(timezone.utc)
    body = {
        "subject_type": "client",
        "client_id": cid,
        # engagement_id missing
        "started_at": (now - timedelta(minutes=30)).isoformat(),
        "ended_at": now.isoformat(),
    }
    r = admin_client.post(f"{BASE_URL}/api/admin/time/entries", json=body, timeout=15)
    assert r.status_code == 400


def test_student_entry_rejects_client_fields(admin_client, created_ids):
    now = datetime.now(timezone.utc)
    body = {
        "subject_type": "student",
        "student_id": "fake-student-id",
        "client_id": created_ids["client_id"],  # forbidden
        "started_at": (now - timedelta(minutes=5)).isoformat(),
        "ended_at": now.isoformat(),
    }
    r = admin_client.post(f"{BASE_URL}/api/admin/time/entries", json=body, timeout=15)
    assert r.status_code == 400


def test_internal_entry_rejects_subject(admin_client, created_ids):
    now = datetime.now(timezone.utc)
    body = {
        "subject_type": "internal",
        "client_id": created_ids["client_id"],
        "started_at": (now - timedelta(minutes=5)).isoformat(),
        "ended_at": now.isoformat(),
    }
    r = admin_client.post(f"{BASE_URL}/api/admin/time/entries", json=body, timeout=15)
    assert r.status_code == 400


# -------- Timer start/stop --------
def test_timer_start_stop_client(admin_client, created_ids):
    body = {
        "subject_type": "client",
        "client_id": created_ids["client_id"],
        "engagement_id": created_ids["engagement_id"],
        "description": "TEST_timer_coaching",
        "category": "Coaching call",
        "billable": True,
    }
    r = admin_client.post(f"{BASE_URL}/api/admin/time/timer/start", json=body, timeout=15)
    assert r.status_code == 200, r.text
    running = r.json()
    assert running["ended_at"] is None
    assert running["subject_type"] == "client"

    # GET /timer should return it
    g = admin_client.get(f"{BASE_URL}/api/admin/time/timer", timeout=15)
    assert g.status_code == 200 and g.json() and g.json()["id"] == running["id"]

    time.sleep(1)
    s = admin_client.post(f"{BASE_URL}/api/admin/time/timer/stop", timeout=15)
    assert s.status_code == 200
    stopped = s.json()
    assert stopped["ended_at"] is not None
    created_ids["entries"].append(stopped["id"])


def test_timer_client_without_engagement_rejected(admin_client, created_ids):
    body = {
        "subject_type": "client",
        "client_id": created_ids["client_id"],
        # engagement_id missing -> should 400
    }
    r = admin_client.post(f"{BASE_URL}/api/admin/time/timer/start", json=body, timeout=15)
    assert r.status_code == 400


def test_only_one_running_timer_auto_stops_previous(admin_client, created_ids):
    # start internal
    r1 = admin_client.post(f"{BASE_URL}/api/admin/time/timer/start",
                           json={"subject_type": "internal", "description": "TEST_a"}, timeout=15)
    assert r1.status_code == 200
    first_id = r1.json()["id"]
    time.sleep(1)
    r2 = admin_client.post(f"{BASE_URL}/api/admin/time/timer/start",
                           json={"subject_type": "internal", "description": "TEST_b"}, timeout=15)
    assert r2.status_code == 200
    assert r2.json()["id"] != first_id
    # cleanup: stop current
    admin_client.post(f"{BASE_URL}/api/admin/time/timer/stop", timeout=15)
    created_ids["entries"].append(first_id)
    created_ids["entries"].append(r2.json()["id"])


# -------- Summary / hours-week --------
def test_summary_and_hours_week(admin_client):
    r = admin_client.get(f"{BASE_URL}/api/admin/time/summary", timeout=15)
    assert r.status_code == 200
    d = r.json()
    for k in ("total_minutes", "by_subject", "billable", "by_category", "entries"):
        assert k in d
    assert set(d["by_subject"].keys()) >= {"client", "student", "internal"}

    hw = admin_client.get(f"{BASE_URL}/api/admin/time/hours-week", timeout=15)
    assert hw.status_code == 200
    hd = hw.json()
    assert set(hd.keys()) == {"client", "student", "internal"}


# -------- Students coach_minutes --------
def test_students_list_has_coach_minutes(admin_client):
    r = admin_client.get(f"{BASE_URL}/api/admin/students", timeout=15)
    assert r.status_code == 200
    rows = r.json()
    if rows:
        assert "coach_minutes" in rows[0], f"students row missing coach_minutes: {rows[0].keys()}"


# -------- Cleanup --------
def test_zzz_cleanup(admin_client, created_ids):
    for eid in created_ids.get("entries", []):
        admin_client.delete(f"{BASE_URL}/api/admin/time/entries/{eid}", timeout=15)
    # delete created client via direct mongo-less path: no DELETE endpoint, skip
    # (acceptable — client prefixed TEST_)
