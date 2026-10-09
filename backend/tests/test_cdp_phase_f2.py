"""Phase F2 — CDP, approval, plan page, proposal, accept, Stripe checkout, conversion."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://english-pro-academy-1.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "andrew.phan723@gmail.com"
ADMIN_PASSWORD = "WinnieAdmin2026!"

_state = {}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"})
    return s


# ---------- fixtures ----------
def test_create_prospect(admin):
    r = admin.post(f"{BASE_URL}/api/admin/prospects", json={
        "first_name": "TESTF2", "last_name": "CDP", "email": "testf2cdp@example.com",
        "mobile": "+61400000222", "consent": True, "source": "manual"
    })
    assert r.status_code in (200, 201), r.text
    pid = r.json()["id"]
    _state["pid"] = pid


def test_save_notes_requires_recommended(admin):
    pid = _state["pid"]
    # Save notes without recommended package
    r = admin.put(f"{BASE_URL}/api/admin/prospects/{pid}/cdp-notes", json={
        "winnie_notes": "Great call. Candidate motivated.",
        "goals": "Senior analyst role",
        "packages": {}
    })
    assert r.status_code == 200
    # draft should fail with no recommended
    r = admin.post(f"{BASE_URL}/api/admin/prospects/{pid}/cdp-draft")
    assert r.status_code == 400


def test_draft_cdp_with_claude(admin):
    pid = _state["pid"]
    r = admin.put(f"{BASE_URL}/api/admin/prospects/{pid}/cdp-notes", json={
        "pronoun": "she/her",
        "education": "Bachelor of Commerce, University of Melbourne, 2022",
        "experience_summary": "2 yrs junior analyst at a mid-tier accounting firm",
        "visa_status": "485 graduate visa, needs sponsorship 2026",
        "salary_expectation": "$85–95k AUD",
        "target_roles": [{"role": "Senior Financial Analyst", "industry": "Banking", "approach": "LinkedIn + referrals"}],
        "challenges": "Interview nerves, limited local network",
        "goals": "Secure a senior analyst role within 6 months",
        "winnie_notes": "She is proactive. Needs structured coaching and interview prep.",
        "packages": {"career-coaching-essentials": "recommended", "interview-for-success": "optional"}
    })
    assert r.status_code == 200
    r = admin.post(f"{BASE_URL}/api/admin/prospects/{pid}/cdp-draft", timeout=90)
    assert r.status_code == 200, r.text
    sections = r.json()
    assert isinstance(sections, dict)
    # Expect several sections
    expected_any = ["current_situation", "goals", "career_recommendation", "support_approach"]
    present = [k for k in expected_any if k in sections]
    assert len(present) >= 3, f"missing sections: {sections.keys()}"
    _state["sections"] = sections


def test_edit_and_save_sections(admin):
    pid = _state["pid"]
    sections = dict(_state["sections"])
    sections["background"] = "EDITED by tester — background summary."
    r = admin.put(f"{BASE_URL}/api/admin/prospects/{pid}/cdp-sections", json={"sections": sections})
    assert r.status_code == 200


def test_approve_creates_plan_token(admin):
    pid = _state["pid"]
    r = admin.post(f"{BASE_URL}/api/admin/prospects/{pid}/cdp-approve")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("plan_token")
    assert "wechat_message" in data
    _state["token"] = data["plan_token"]


# ---------- public plan ----------
def test_public_plan_page_sets_viewed():
    token = _state["token"]
    r = requests.get(f"{BASE_URL}/api/plan/{token}")
    assert r.status_code == 200
    data = r.json()
    assert data["first_name"] == "TESTF2"
    assert data["pdf"] is True
    assert isinstance(data["sections"], dict) and data["sections"]


def test_public_plan_pdf():
    token = _state["token"]
    r = requests.get(f"{BASE_URL}/api/plan/{token}/pdf")
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("application/pdf")
    assert r.content[:5] == b"%PDF-"


# ---------- proposal ----------
def test_proposal_base_price_recommended_only():
    token = _state["token"]
    r = requests.get(f"{BASE_URL}/api/plan/{token}/proposal")
    assert r.status_code == 200
    data = r.json()
    assert data["terms_version"] == "CS-1.0"
    # Base total should be $2,310 inc GST = 231000 cents
    assert data["total_cents"] == 231000, data
    # Two lines: coaching_essentials included; interview_success optional not included
    keys = {l["key"]: l for l in data["lines"]}
    assert keys["career-coaching-essentials"]["included"] is True
    assert keys["career-coaching-essentials"]["inc_cents"] == 231000
    assert keys["interview-for-success"]["included"] is False
    assert keys["interview-for-success"]["optional"] is True


def test_proposal_with_addon_doubles():
    token = _state["token"]
    r = requests.get(f"{BASE_URL}/api/plan/{token}/proposal", params={"addons": "interview-for-success"})
    assert r.status_code == 200
    data = r.json()
    # With both @ $2,310 = $4,620 = 462000
    assert data["total_cents"] == 462000, data


# ---------- accept ----------
def test_accept_requires_consent():
    token = _state["token"]
    r = requests.post(f"{BASE_URL}/api/plan/{token}/accept", json={
        "full_name": "TESTF2 CDP", "email": "testf2cdp@example.com",
        "signature": "TESTF2 CDP", "consent": False, "addons": []})
    assert r.status_code == 400


def test_accept_success():
    token = _state["token"]
    r = requests.post(f"{BASE_URL}/api/plan/{token}/accept", json={
        "full_name": "TESTF2 CDP", "preferred_name": "TESTF2",
        "email": "testf2cdp@example.com", "mobile": "+61400000222",
        "signature": "TESTF2 CDP", "consent": True, "addons": []})
    assert r.status_code == 200, r.text
    # Re-fetch proposal: accepted true
    r = requests.get(f"{BASE_URL}/api/plan/{token}/proposal")
    assert r.json()["accepted"] is True


# ---------- stripe checkout URL ----------
def test_checkout_creates_stripe_url():
    token = _state["token"]
    r = requests.post(f"{BASE_URL}/api/plan/{token}/checkout", json={
        "addons": [], "origin_url": BASE_URL})
    assert r.status_code == 200, r.text
    url = r.json()["url"]
    assert "stripe.com" in url or "checkout.stripe" in url
    _state["checkout_url"] = url


# ---------- confirm with fake session fails ----------
def test_confirm_invalid_session_rejected():
    token = _state["token"]
    r = requests.get(f"{BASE_URL}/api/plan/{token}/confirm", params={"session_id": "cs_test_fake_bad"})
    assert r.status_code == 400


# ---------- cleanup ----------
def test_cleanup_delete_prospect(admin):
    pid = _state.get("pid")
    if not pid:
        pytest.skip("no prospect created")
    r = admin.delete(f"{BASE_URL}/api/admin/prospects/{pid}")
    # Accept 200/204 or 404 if already purged
    assert r.status_code in (200, 204, 404), r.text
