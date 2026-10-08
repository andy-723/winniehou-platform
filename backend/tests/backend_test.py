"""Comprehensive backend tests for Winnie Hou LMS."""
import io
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or "https://english-pro-academy-1.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "andrew.phan723@gmail.com"
ADMIN_PASS = "WinnieAdmin2026!"
STUDENT_EMAIL = "student@example.com"
STUDENT_PASS = "Student123!"


# ---------- helpers ----------
def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed {r.status_code}: {r.text}"
    return r.json()["access_token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="session")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope="session")
def student_token():
    return _login(STUDENT_EMAIL, STUDENT_PASS)


@pytest.fixture(scope="session")
def seeded_courses():
    r = requests.get(f"{API}/courses", timeout=20)
    assert r.status_code == 200
    return r.json()


# ---------- health ----------
def test_health():
    r = requests.get(f"{API}/health", timeout=10)
    assert r.status_code == 200
    assert r.json()["ok"] is True


# ---------- auth ----------
class TestAuth:
    def test_register_and_me(self):
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/auth/register", json={"name": "Test User", "email": email, "password": "TestPass123!"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data and data["user"]["email"] == email
        tok = data["access_token"]

        me = requests.get(f"{API}/auth/me", headers=_h(tok))
        assert me.status_code == 200
        assert me.json()["email"] == email

        # duplicate
        r2 = requests.post(f"{API}/auth/register", json={"name": "x", "email": email, "password": "TestPass123!"})
        assert r2.status_code == 400

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": STUDENT_EMAIL, "password": "wrongpass"})
        assert r.status_code in (401, 429)

    def test_session_cap_2(self):
        # create a fresh user to not interfere with other sessions
        email = f"cap_{uuid.uuid4().hex[:8]}@example.com"
        requests.post(f"{API}/auth/register", json={"name": "cap", "email": email, "password": "TestPass123!"})
        t1 = _login(email, "TestPass123!")
        t2 = _login(email, "TestPass123!")
        t3 = _login(email, "TestPass123!")
        r1 = requests.get(f"{API}/auth/me", headers=_h(t1))
        r2 = requests.get(f"{API}/auth/me", headers=_h(t2))
        r3 = requests.get(f"{API}/auth/me", headers=_h(t3))
        assert r1.status_code == 401, "first session should be evicted"
        assert r2.status_code == 200
        assert r3.status_code == 200
        sess = requests.get(f"{API}/auth/sessions", headers=_h(t3))
        assert sess.status_code == 200
        assert len(sess.json()) <= 2


# ---------- courses ----------
class TestCourses:
    def test_list_courses(self, seeded_courses):
        assert len(seeded_courses) >= 4
        for c in seeded_courses:
            assert "lesson_count" in c and "id" in c

    def test_filters_endpoint(self):
        r = requests.get(f"{API}/courses/filters")
        assert r.status_code == 200
        data = r.json()
        assert "Advanced" in data["levels"]
        assert "Email" in data["topics"]

    def test_filter_queries(self):
        r = requests.get(f"{API}/courses", params={"level": "Advanced", "topic": "Email", "max_price": 9999})
        assert r.status_code == 200
        # may be empty; just validate filtering works - price filter sanity
        r2 = requests.get(f"{API}/courses", params={"level": "Advanced"})
        assert r2.status_code == 200
        assert all(c["level"] == "Advanced" for c in r2.json())

    def test_course_detail_anonymous_lesson_locking(self, seeded_courses):
        c = next((c for c in seeded_courses if c["lesson_count"] >= 2), seeded_courses[0])
        r = requests.get(f"{API}/courses/{c['id']}")
        assert r.status_code == 200
        detail = r.json()
        preview_lesson = None
        locked_lesson = None
        for m in detail["modules"]:
            for l in m["lessons"]:
                if l.get("locked") is False:
                    preview_lesson = l
                elif l.get("locked") is True:
                    locked_lesson = l
        assert preview_lesson is not None, "should have a preview lesson unlocked"
        # anonymous preview lesson should be fetchable
        lr = requests.get(f"{API}/courses/{c['id']}/lessons/{preview_lesson['id']}")
        assert lr.status_code == 200
        ldata = lr.json()
        if ldata.get("video"):
            assert ldata["video"]["provider"] == "url"
        # non-preview lesson should 403 for anonymous
        if locked_lesson:
            lr2 = requests.get(f"{API}/courses/{c['id']}/lessons/{locked_lesson['id']}")
            assert lr2.status_code == 403


# ---------- payments ----------
class TestPayments:
    def test_validate_coupon_launch20(self, student_token, seeded_courses):
        c = seeded_courses[0]
        body = {"items": [{"type": "course", "id": c["id"]}], "coupon_code": "LAUNCH20", "origin_url": BASE_URL}
        r = requests.post(f"{API}/payments/validate-coupon", json=body, headers=_h(student_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["discount"] == round(c["price"] * 0.2)

    def test_validate_coupon_invalid(self, student_token, seeded_courses):
        c = seeded_courses[0]
        body = {"items": [{"type": "course", "id": c["id"]}], "coupon_code": "NOPE", "origin_url": BASE_URL}
        r = requests.post(f"{API}/payments/validate-coupon", json=body, headers=_h(student_token))
        assert r.status_code == 400

    def test_create_checkout_session(self, seeded_courses):
        # Use a brand new student (demo student may already own courses)
        email = f"buyer_{uuid.uuid4().hex[:8]}@example.com"
        requests.post(f"{API}/auth/register", json={"name": "Buyer", "email": email, "password": "TestPass123!"})
        tok = _login(email, "TestPass123!")
        c = seeded_courses[0]
        body = {"items": [{"type": "course", "id": c["id"]}], "origin_url": BASE_URL}
        r = requests.post(f"{API}/payments/checkout", json=body, headers=_h(tok))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["checkout_url"].startswith("https://checkout.stripe.com")
        assert data["session_id"]

        st = requests.get(f"{API}/payments/status/{data['session_id']}")
        assert st.status_code == 200
        assert st.json()["payment_status"] in ("pending",)


# ---------- full purchase simulation via admin grant ----------
class TestEnrollmentFlow:
    def test_admin_grant_and_progress(self, admin_token, seeded_courses):
        email = f"grant_{uuid.uuid4().hex[:8]}@example.com"
        reg = requests.post(f"{API}/auth/register", json={"name": "Grant", "email": email, "password": "TestPass123!"}).json()
        user_id = reg["user"]["id"]
        s_tok = reg["access_token"]
        c = next(c for c in seeded_courses if c["lesson_count"] >= 1)

        # grant
        r = requests.patch(f"{API}/admin/students/{user_id}", json={"grant_course_id": c["id"]}, headers=_h(admin_token))
        assert r.status_code == 200

        # /me/courses
        mc = requests.get(f"{API}/me/courses", headers=_h(s_tok))
        assert mc.status_code == 200
        assert any(x["course"]["id"] == c["id"] for x in mc.json())

        # fetch course detail (student token) to get a lesson id
        detail = requests.get(f"{API}/courses/{c['id']}", headers=_h(s_tok)).json()
        lesson_id = detail["modules"][0]["lessons"][0]["id"]

        # progress complete
        pr = requests.post(f"{API}/courses/{c['id']}/lessons/{lesson_id}/progress",
                           json={"position_seconds": 10, "completed": True}, headers=_h(s_tok))
        assert pr.status_code == 200

        prog = requests.get(f"{API}/courses/{c['id']}/progress", headers=_h(s_tok))
        assert prog.status_code == 200
        assert prog.json()["percent"] > 0

        # lesson detail now has progress + watermark == email
        ld = requests.get(f"{API}/courses/{c['id']}/lessons/{lesson_id}", headers=_h(s_tok))
        assert ld.status_code == 200
        d = ld.json()
        assert d["watermark"] == email
        assert d["progress"] is not None


# ---------- admin ----------
class TestAdmin:
    def test_admin_requires_role(self, student_token):
        r = requests.get(f"{API}/admin/dashboard", headers=_h(student_token))
        assert r.status_code == 403

    def test_dashboard(self, admin_token):
        r = requests.get(f"{API}/admin/dashboard", headers=_h(admin_token))
        assert r.status_code == 200
        d = r.json()
        for k in ("revenue", "students", "top_courses"):
            assert k in d

    def test_course_crud_and_visibility(self, admin_token):
        payload = {"title": f"TEST Course {uuid.uuid4().hex[:6]}", "price": 1000, "published": False}
        r = requests.post(f"{API}/admin/courses", json=payload, headers=_h(admin_token))
        assert r.status_code == 200
        cid = r.json()["id"]

        # not in public list
        pub = requests.get(f"{API}/courses").json()
        assert all(c["id"] != cid for c in pub)

        # update with modules
        up = {**payload, "published": True, "modules": [
            {"title": "M1", "lessons": [{"title": "L1", "is_preview": True}]},
        ]}
        r2 = requests.put(f"{API}/admin/courses/{cid}", json=up, headers=_h(admin_token))
        assert r2.status_code == 200
        updated = r2.json()
        assert updated["modules"][0]["id"]
        assert updated["modules"][0]["lessons"][0]["id"]

        pub2 = requests.get(f"{API}/courses").json()
        assert any(c["id"] == cid for c in pub2)

        # delete
        rd = requests.delete(f"{API}/admin/courses/{cid}", headers=_h(admin_token))
        assert rd.status_code == 200

    def test_coupon_crud(self, admin_token):
        code = f"TEST{uuid.uuid4().hex[:5].upper()}"
        r = requests.post(f"{API}/admin/coupons",
                          json={"code": code, "kind": "percent", "value": 10, "active": True},
                          headers=_h(admin_token))
        assert r.status_code == 200
        cid = r.json()["id"]
        rd = requests.delete(f"{API}/admin/coupons/{cid}", headers=_h(admin_token))
        assert rd.status_code == 200

    def test_product_crud(self, admin_token):
        r = requests.post(f"{API}/admin/products",
                          json={"title": f"TEST Prod {uuid.uuid4().hex[:6]}", "price": 500, "active": True},
                          headers=_h(admin_token))
        assert r.status_code == 200
        pid = r.json()["id"]
        pubs = requests.get(f"{API}/products").json()
        assert any(p["id"] == pid for p in pubs)
        requests.delete(f"{API}/admin/products/{pid}", headers=_h(admin_token))

    def test_post_crud(self, admin_token):
        r = requests.post(f"{API}/admin/posts",
                          json={"title": f"TEST Post {uuid.uuid4().hex[:6]}", "content": "<p>hi</p>", "published": True},
                          headers=_h(admin_token))
        assert r.status_code == 200
        post = r.json()
        slug = post["slug"]
        pub = requests.get(f"{API}/blog/{slug}")
        assert pub.status_code == 200
        requests.delete(f"{API}/admin/posts/{post['id']}", headers=_h(admin_token))

    def test_orders_list(self, admin_token):
        r = requests.get(f"{API}/admin/orders", headers=_h(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_bunny_status_and_video(self, admin_token):
        r = requests.get(f"{API}/admin/bunny/status", headers=_h(admin_token))
        assert r.status_code == 200
        assert r.json()["configured"] is False
        # videos endpoint should 503
        files = {"file": ("test.mp4", b"notavid", "video/mp4")}
        data = {"title": "x"}
        v = requests.post(f"{API}/admin/videos", headers=_h(admin_token), files=files, data=data)
        assert v.status_code == 503


# ---------- file upload (course scope) ----------
class TestFileUpload:
    def test_pdf_upload_and_access(self, admin_token, seeded_courses):
        c = seeded_courses[0]
        pdf_bytes = b"%PDF-1.4\n%EOF\n"
        files = {"file": ("test.pdf", pdf_bytes, "application/pdf")}
        data = {"scope": "course", "course_id": c["id"]}
        r = requests.post(f"{API}/admin/upload", headers=_h(admin_token), files=files, data=data)
        if r.status_code == 502:
            pytest.skip("Object storage unavailable in this env")
        assert r.status_code == 200, r.text
        fid = r.json()["id"]

        # non-enrolled fresh user -> 403
        email = f"ne_{uuid.uuid4().hex[:6]}@example.com"
        reg = requests.post(f"{API}/auth/register",
                            json={"name": "ne", "email": email, "password": "TestPass123!"}).json()
        t = reg["access_token"]
        rf = requests.get(f"{API}/files/{fid}", headers=_h(t))
        assert rf.status_code == 403

        # admin can access
        ra = requests.get(f"{API}/files/{fid}", headers=_h(admin_token))
        assert ra.status_code == 200
        assert ra.content.startswith(b"%PDF")



# ---------- services / enquiries / waitlist ----------
class TestServicesPublic:
    def test_list_services_published(self):
        r = requests.get(f"{API}/services", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        keys = {s["key"] for s in data}
        for expected in ["career-coaching-essentials", "interview-for-success",
                         "bundle", "business-english-quantum-leap"]:
            assert expected in keys, f"missing {expected} in {keys}"
        # sorted by sort_order ascending
        orders = [s.get("sort_order", 0) for s in data]
        assert orders == sorted(orders)
        for s in data:
            assert s.get("status") == "published"
            assert "_id" not in s

    def test_enquiry_requires_consent(self):
        body = {"name": "T", "email": "t@example.com", "consent": False,
                "package": "bundle", "message": "hi"}
        r = requests.post(f"{API}/service-enquiries", json=body, timeout=20)
        assert r.status_code == 400

    def test_enquiry_success(self, admin_token):
        em = f"enq_{uuid.uuid4().hex[:6]}@example.com"
        body = {"name": "TEST Enq", "email": em, "phone": "0400", "package": "bundle",
                "message": "please contact", "consent": True}
        r = requests.post(f"{API}/service-enquiries", json=body, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json() == {"ok": True}
        # verify stored (admin)
        lst = requests.get(f"{API}/admin/service-enquiries", headers=_h(admin_token)).json()
        assert any(e["email"] == em for e in lst)

    def test_waitlist_success(self, admin_token):
        em = f"wl_{uuid.uuid4().hex[:6]}@example.com"
        r = requests.post(f"{API}/waitlist",
                          json={"name": "TEST WL", "email": em, "source": "1on1"}, timeout=20)
        assert r.status_code == 200
        assert r.json() == {"ok": True}
        lst = requests.get(f"{API}/admin/waitlist", headers=_h(admin_token)).json()
        assert any(w["email"] == em for w in lst)


class TestServicesAdmin:
    def test_requires_admin(self, student_token):
        for path in ("/admin/services", "/admin/service-enquiries", "/admin/waitlist"):
            r_anon = requests.get(f"{API}{path}")
            assert r_anon.status_code in (401, 403)
            r_s = requests.get(f"{API}{path}", headers=_h(student_token))
            assert r_s.status_code == 403

    def test_services_crud(self, admin_token):
        key = f"test-pkg-{uuid.uuid4().hex[:6]}"
        body = {"key": key, "name": "TEST PKG", "tagline": "t", "description": "d",
                "inclusions": ["a", "b"], "duration_label": "4w", "price_cents": 100000,
                "gst_treatment": "ex_gst", "sort_order": 99, "status": "draft",
                "cta_type": "enquire"}
        r = requests.post(f"{API}/admin/services", json=body, headers=_h(admin_token))
        assert r.status_code == 200, r.text
        created = r.json()
        sid = created["id"]
        assert created["key"] == key

        # duplicate -> 400
        r_dup = requests.post(f"{API}/admin/services", json=body, headers=_h(admin_token))
        assert r_dup.status_code == 400

        # update
        upd = {**body, "name": "TEST PKG UPDATED", "status": "published"}
        r2 = requests.put(f"{API}/admin/services/{sid}", json=upd, headers=_h(admin_token))
        assert r2.status_code == 200
        assert r2.json()["name"] == "TEST PKG UPDATED"
        # verify list
        lst = requests.get(f"{API}/admin/services", headers=_h(admin_token)).json()
        assert any(s["id"] == sid and s["status"] == "published" for s in lst)

        # delete
        rd = requests.delete(f"{API}/admin/services/{sid}", headers=_h(admin_token))
        assert rd.status_code == 200

        lst2 = requests.get(f"{API}/admin/services", headers=_h(admin_token)).json()
        assert all(s["id"] != sid for s in lst2)

    def test_mark_enquiry_contacted(self, admin_token):
        em = f"enq2_{uuid.uuid4().hex[:6]}@example.com"
        requests.post(f"{API}/service-enquiries",
                      json={"name": "T", "email": em, "consent": True, "message": "x"})
        lst = requests.get(f"{API}/admin/service-enquiries", headers=_h(admin_token)).json()
        rec = next(e for e in lst if e["email"] == em)
        assert rec["contacted"] is False
        r = requests.patch(f"{API}/admin/service-enquiries/{rec['id']}?contacted=true",
                           headers=_h(admin_token))
        assert r.status_code == 200
        lst2 = requests.get(f"{API}/admin/service-enquiries", headers=_h(admin_token)).json()
        rec2 = next(e for e in lst2 if e["email"] == em)
        assert rec2["contacted"] is True
