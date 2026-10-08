# Winnie Hou — Business English Mastery LMS

## Original problem statement
Premium LMS + e-commerce for working professionals: course catalog, Stripe one-time purchases, course player (video + notes + PDFs, watermark, resume), progress tracking, 2-device session cap, digital workbook shop, blog, and a full admin CMS. Being extended into a career-coaching brand site ("Better Careers" / Winnie Hou) per Andrew's add-only Emergent Build Plan (v2, 8 Oct 2026): Services packages, About/Contact, student tracker, written submissions + coach review, and a lead-gen /start landing.

## User choices
- Video: Bunny Stream (credentials PENDING — direct MP4 URL fallback active)
- Payments: Stripe (Emergent sandbox, test mode, AU account)
- Shop: digital-only (PDF workbooks)
- Auth: email + password JWT
- Pricing (June 2026 → revised Oct 2026): PUBLIC PRICING IS HIDDEN. Website shows courses/shop/services WITHOUT prices (services show "POA"; course/product CTAs become "Enquire"; nav cart hidden). Prices stay stored in DB, to be revealed only to prospects via a personalised link (/start, Phase E). Toggle = `frontend/src/lib/config.js` PUBLIC_PRICING.
- "Business English Quantum Leap" exists BOTH as a catalogue course and a coaching service package (genuinely different) — show POA, no price on site.
- Coaching package prices come only from the fixed AUD table. GST-inclusive display helper (`servicePrice` in config.js).
- Home-page unverified claims replaced with [TBC] / [TO CONFIRM] placeholders (ACL safety).

## Architecture
- Backend: FastAPI `/app/backend` — `server.py`, `core.py`, `emailer.py`, `seed.py`, `routers/{auth,courses,payments,content,admin}.py`
- Frontend: React (JSX) `/app/frontend/src` — pages/, pages/admin/, components/, context/, lib/ (api.js, config.js)
- DB: MongoDB. Added collections: service_packages, service_enquiries, waitlist
- Design: navy #0A192F / gold #D4AF37 / ivory; Playfair Display + Manrope

## Implemented
### Baseline (2026-06)
- Auth (JWT, bcrypt, 2-session cap, reset email), catalog+filters, course detail/player (watermark, resume), progress, My Learning dashboard, Stripe checkout+webhook+refund, shop+cart, blog, full Admin CMS, seed (4 courses/3 products/2 posts/LAUNCH20/demo student). Tested iteration_1.

### Phase A + B + pricing-hide (2026-10-08)
- Services: `service_packages` collection seeded with 4 fixed AUD packages (Essentials 195000 ex_gst, Interview 195000 ex_gst, Bundle 390000 ex_gst, Quantum Leap 385000 inc_gst), all status=published, placeholder copy.
  - Public: GET /api/services, POST /api/service-enquiries (consent required), POST /api/waitlist
  - Admin: /api/admin/services CRUD, /api/admin/service-enquiries (+PATCH mark contacted), /api/admin/waitlist
  - Frontend /services: package cards (POA, Best-value badge on bundle, book_call→Enquire fallback when no Calendly), enquiry form, 1-on-1 "register interest" waitlist.
  - Admin CMS "Services" sidebar item → /admin/services with Packages/Enquiries/Waitlist tabs + package editor modal.
- About page (/about) and Contact page (/contact, saves to service_enquiries type=contact, ?subject= prefill, WeChat QR slot). Nav updated: About, Courses, Services, Shop, Blog, Contact + footer links.
- Public pricing hidden across Home, CourseCard, CourseDetail, Shop; nav cart hidden. Home band "Work with Winnie" → /services. Home claims → placeholders.
- Tested iteration_2: 28/28 backend pytest + all frontend flows pass.

### Phase C — Student performance tracker (2026-10-08)
- Backend `routers/admin.py`: `student_metrics()` (percent, lessons_completed, last_active, status active/at_risk/completed, per_course with module bars) + `student_timeline()` (completed lessons + purchases). Extended GET /admin/students (adds progress_percent, lessons_completed, last_active, status), GET /admin/students/{id} (metrics + timeline + admin_notes), PATCH /admin/students/{id} (notes persistence), and /admin/dashboard (at_risk_students, avg_completion).
- Frontend AdminStudents: status filter tabs (All/Active/At risk/Completed w/ counts), progress-bar + lessons + last-active + status columns; detail modal gets 4-metric header, per-course module-by-module progress, activity timeline, admin notes. AdminDashboard: 2 new stat cards (At risk, Avg completion).
- At-risk = active enrollments + no activity 7+ days. Tested iteration_3: 7/7 backend pytest + all frontend flows pass.

### Phase E — /start personalised prospect landing (2026-10-08)
- Public `/start` route (not in nav). Reads `?name=` + `?lead=`; greets "Hi {name}" (fallback "Hi there"). Reveals REAL coaching package pricing via `servicePrice` helper (bypasses the public POA hiding — this is the prospect-only pricing reveal the user wanted).
- Primary CTA "Book your strategy call" → CALENDLY_URL in new tab with `utm_content=<lead>`; secondary "Pay deposit" → STRIPE_DEPOSIT_URL; both hidden until their env vars (REACT_APP_CALENDLY_URL / REACT_APP_STRIPE_DEPOSIT_URL) are set — fallback shows "Enquire with Winnie" → /contact.
- Each visit with a `lead` param is logged: POST /api/lead-visits → `lead_visits` collection. Admin → Services now has a 4th "Lead visits" tab (GET /api/admin/lead-visits).
- Self-tested: lead-visit logging + admin list via curl; /start render (greeting + revealed pricing + fallback CTA) via screenshot. Note: the broader "automation front" (Typeform→Make.com→Gamma CDP→Google Sheets) in Andrew's As-Built doc is EXTERNAL SaaS, not in this app's scope — the platform only provides the /start endpoint.

## Backlog / Roadmap

### UI redesign — Candace-Owens model (2026-10-08, in progress)
- Modeled on candaceowens.com (dark premium "velvet-rope", horizontal content carousels with "Explore all", editorial hero, membership CTA band) recoloured to navy #0A192F / gold #D4AF37 / ivory #F9F8F3. Blueprint: `/app/design_guidelines.json`.
- DONE: design-system utilities in index.css (scrollbar-none, btn-gold-outline, eyebrow-dark, card-dark, input-dark, shimmer); new Shared components `CourseCard` (dark), `ContentRow` (carousel), `MembershipBand`; dark `PageHeader`/`Empty`. **All public pages converted to the dark system**: Home, Catalog, Course Detail, Services, Shop, Blog + BlogPost, About, Contact, /start. Funnel pricing preserved (no public prices; "Enquire"/POA). Verified via screenshots (desktop + mobile), no overflow.
- TODO: Student Dashboard + auth pages still on light theme (optional future pass). Real imagery + authority-logo strip pending Winnie's assets.
- Preview-check 2026-10-08 resolved: prices confirmed correct as seeded; POA-vs-/start is by-design (funnel kept); invented-copy scrub deferred (wording TBD); test-data cleanup deferred.

- P0: Bunny Stream credentials (BUNNY_LIBRARY_ID, BUNNY_STREAM_API_KEY, BUNNY_TOKEN_AUTH_KEY) → verify upload + signed embed. (Pending user keys.)
- P0: Revised "automation front" MD — user referenced a local Downloads MD that was NOT uploaded; re-request before building Phase E.
- P1 (Build Plan Phase C): Student performance tracker — DONE 2026-10-08 (iteration_3).
- P1 (Phase D): Written-activity lesson type + submissions queue + coach review (+ AI "Suggest feedback" via Emergent LLM key / Claude — user approved).
- P1 (Phase E): /start personalised landing — DONE 2026-10-08. To activate CTAs, set REACT_APP_CALENDLY_URL and REACT_APP_STRIPE_DEPOSIT_URL in frontend/.env.
- P2 hardening (pre-launch): rate-limit/captcha on public enquiry+waitlist; EmailStr validation; optional API-layer price masking for anonymous callers; completion certificates; SEO/OG per course.
