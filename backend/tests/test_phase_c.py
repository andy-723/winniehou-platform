"""Phase C: student performance tracker tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or "http://localhost:8001"
ADMIN = {"email": "andrew.phan723@gmail.com", "password": "WinnieAdmin2026!"}
STUDENT = {"email": "student@example.com", "password": "Student123!"}


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login failed {r.status_code}: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def student_token():
    return _login(STUDENT)


@pytest.fixture(scope="module")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def student_h(student_token):
    return {"Authorization": f"Bearer {student_token}"}


# ----- dashboard new fields -----
def test_dashboard_has_phase_c_fields(admin_h):
    r = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=admin_h, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert "at_risk_students" in d and isinstance(d["at_risk_students"], int)
    assert "avg_completion" in d and isinstance(d["avg_completion"], int)
    assert 0 <= d["avg_completion"] <= 100


# ----- /admin/students shape -----
def test_students_list_has_progress_fields(admin_h):
    r = requests.get(f"{BASE_URL}/api/admin/students", headers=admin_h, timeout=60)
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list) and len(rows) > 0
    for u in rows:
        for k in ("progress_percent", "lessons_completed", "last_active", "status"):
            assert k in u, f"missing {k} in student row {u.get('email')}"
        assert u["status"] in ("active", "at_risk", "completed")
        assert isinstance(u["progress_percent"], int)
        assert isinstance(u["lessons_completed"], int)


def _find_student_id(admin_h, email):
    r = requests.get(f"{BASE_URL}/api/admin/students", headers=admin_h, params={"q": email}, timeout=30)
    r.raise_for_status()
    for u in r.json():
        if u["email"].lower() == email.lower():
            return u["id"]
    pytest.skip(f"Student {email} not found")


# ----- /admin/students/{id} shape -----
def test_student_detail_has_metrics_timeline_notes(admin_h):
    sid = _find_student_id(admin_h, STUDENT["email"])
    r = requests.get(f"{BASE_URL}/api/admin/students/{sid}", headers=admin_h, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert "metrics" in data and "timeline" in data and "admin_notes" in data
    m = data["metrics"]
    for k in ("percent", "lessons_completed", "lessons_total", "last_active", "status", "per_course"):
        assert k in m, f"missing metric {k}"
    assert isinstance(data["timeline"], list)
    # per_course entries shape
    for c in m["per_course"]:
        assert "course_title" in c and "percent" in c and "modules" in c
        for mod in c["modules"]:
            assert "module_id" in mod and "title" in mod and "percent" in mod


# ----- PATCH notes -----
def test_patch_notes_persists(admin_h):
    sid = _find_student_id(admin_h, STUDENT["email"])
    note = "TEST_phase_c_note_abc123"
    r = requests.patch(f"{BASE_URL}/api/admin/students/{sid}", headers=admin_h, json={"notes": note}, timeout=20)
    assert r.status_code == 200
    r2 = requests.get(f"{BASE_URL}/api/admin/students/{sid}", headers=admin_h, timeout=20)
    assert r2.json().get("admin_notes") == note
    # restore
    requests.patch(f"{BASE_URL}/api/admin/students/{sid}", headers=admin_h, json={"notes": ""}, timeout=20)


# ----- End-to-end progress -----
def test_end_to_end_progress_flow(admin_h, student_h):
    # find an enrolled course for the student
    me_courses = requests.get(f"{BASE_URL}/api/me/courses", headers=student_h, timeout=20)
    assert me_courses.status_code == 200
    enrolled = me_courses.json()
    if not enrolled:
        # grant via admin
        sid = _find_student_id(admin_h, STUDENT["email"])
        courses = requests.get(f"{BASE_URL}/api/admin/courses", headers=admin_h, timeout=20).json()
        if not courses:
            pytest.skip("no courses to grant")
        cid = courses[0]["id"]
        requests.patch(f"{BASE_URL}/api/admin/students/{sid}", headers=admin_h,
                       json={"grant_course_id": cid}, timeout=20)
        me_courses = requests.get(f"{BASE_URL}/api/me/courses", headers=student_h, timeout=20)
        enrolled = me_courses.json()
        if not enrolled:
            pytest.skip("could not enroll")

    # pick enrolled course that actually has lessons; if none, grant one
    course_id = None
    for e in enrolled:
        cid = e["course"]["id"]
        full = requests.get(f"{BASE_URL}/api/admin/courses/{cid}", headers=admin_h, timeout=20).json()
        if sum(len(m.get("lessons", [])) for m in full.get("modules", [])) > 0:
            course_id = cid
            break
    if not course_id:
        sid0 = _find_student_id(admin_h, STUDENT["email"])
        all_courses = requests.get(f"{BASE_URL}/api/admin/courses", headers=admin_h, timeout=20).json()
        for c in all_courses:
            full = requests.get(f"{BASE_URL}/api/admin/courses/{c['id']}", headers=admin_h, timeout=20).json()
            if sum(len(m.get("lessons", [])) for m in full.get("modules", [])) > 0:
                requests.patch(f"{BASE_URL}/api/admin/students/{sid0}", headers=admin_h,
                               json={"grant_course_id": c["id"]}, timeout=20)
                course_id = c["id"]
                break
    assert course_id, "no course with lessons found"
    detail = requests.get(f"{BASE_URL}/api/admin/courses/{course_id}", headers=admin_h, timeout=20).json()
    lesson_id = None
    for m in detail.get("modules", []):
        for l in m.get("lessons", []):
            lesson_id = l["id"]
            break
        if lesson_id:
            break
    assert lesson_id, "no lesson found"

    # before snapshot
    sid = _find_student_id(admin_h, STUDENT["email"])
    before = requests.get(f"{BASE_URL}/api/admin/students/{sid}", headers=admin_h, timeout=20).json()
    before_done = before["metrics"]["lessons_completed"]

    # mark lesson complete
    r = requests.post(f"{BASE_URL}/api/courses/{course_id}/lessons/{lesson_id}/progress",
                      headers=student_h, json={"completed": True, "position_seconds": 10}, timeout=20)
    assert r.status_code == 200, r.text
    assert r.json().get("completed") is True

    # after snapshot
    after = requests.get(f"{BASE_URL}/api/admin/students/{sid}", headers=admin_h, timeout=20).json()
    assert after["metrics"]["lessons_completed"] >= max(before_done, 1), \
        f"lessons_completed did not update: before={before_done} after={after['metrics']['lessons_completed']}"
    assert after["metrics"]["last_active"] is not None
    assert after["metrics"]["status"] in ("active", "completed")

    # timeline should have at least one lesson event
    types = {e.get("type") for e in after["timeline"]}
    assert "lesson" in types, f"timeline missing lesson entry: {after['timeline'][:3]}"

    # per_course percent for this course should be >= before
    per_before = {c["course_id"]: c["percent"] for c in before["metrics"]["per_course"]}
    per_after = {c["course_id"]: c["percent"] for c in after["metrics"]["per_course"]}
    assert per_after.get(course_id, 0) >= per_before.get(course_id, 0)

    # also verify in list endpoint
    rows = requests.get(f"{BASE_URL}/api/admin/students", headers=admin_h,
                        params={"q": STUDENT["email"]}, timeout=30).json()
    me = next(u for u in rows if u["email"] == STUDENT["email"])
    assert me["lessons_completed"] >= 1
    assert me["last_active"] is not None


# ----- Regression basics -----
def test_services_still_public():
    r = requests.get(f"{BASE_URL}/api/services", timeout=20)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_courses_public_hides_price_absent_check():
    r = requests.get(f"{BASE_URL}/api/courses", timeout=20)
    assert r.status_code == 200
