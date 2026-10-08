# Winnie Hou — Business English Mastery LMS

## Original problem statement
Premium LMS + e-commerce for working professionals: course catalog, Stripe one-time purchases, course player (video + notes + PDFs, watermark, resume), progress tracking, 2-device session cap, digital workbook shop, blog, and a full admin CMS (courses/lessons, Bunny Stream upload, students, refunds, coupons, products, blog, dashboard).

## User choices (June 2026)
- Video: Bunny Stream (credentials pending — direct MP4 URL fallback active)
- Payments: Stripe (Emergent sandbox, test mode, AU account → managed payments / tax "full")
- Shop: digital-only (PDF workbooks)
- Extras: free preview lessons (certificates deferred)
- Auth: email + password JWT

## Architecture
- Backend: FastAPI `/app/backend` — `server.py`, `core.py` (db, JWT, sessions, object storage), `emailer.py` (Resend via Emergent proxy), `seed.py`, `routers/{auth,courses,payments,content,admin}.py`
- Frontend: React (JSX) `/app/frontend/src` — pages/, pages/admin/, components/, context/ (Auth, Cart), lib/api.js
- DB: MongoDB collections: users, sessions, courses (embedded modules/lessons), enrollments, progress, orders, payment_transactions, coupons, products, product_access, posts, files, videos, password_reset_tokens, login_attempts
- Storage: Emergent Object Storage (thumbnails public, PDFs access-gated via `/api/files/{id}`)
- Design: navy #0A192F / gold #D4AF37 / ivory; Playfair Display + Manrope

## Implemented (2026-06)
- Auth: register/login/logout/refresh (httpOnly cookies + Bearer), bcrypt, brute-force lockout, 2-session cap, forgot/reset password email, admin seeded from env
- Catalog + filters, course detail with preview locking, player (collapsible rail, watermark, resume position, mark complete, next/prev, PDF downloads)
- Progress per lesson/module/course; My Learning dashboard (courses, downloads, orders, devices)
- Stripe Checkout (multi-item cart, server-side coupons, ad-hoc price_data w/ tax codes), webhook + status polling, fulfillment → enrollments/product access, receipt email, refund (admin) revokes access
- Shop + cart, payment success/cancel, printable receipt
- Blog list/post
- Admin CMS: dashboard (revenue chart, top courses, recent orders), course editor (modules/lessons, rich text, thumbnail upload, PDF attach, Bunny upload w/ progress bar — shows notice when unconfigured), students (disable, grant/revoke, clear sessions), orders/refunds, coupons, products, blog editor
- Seed: 4 courses, 3 products, 2 posts, LAUNCH20 coupon, demo student

## Backlog
- P0: Bunny Stream credentials (BUNNY_LIBRARY_ID, BUNNY_STREAM_API_KEY, BUNNY_TOKEN_AUTH_KEY) → verify upload + signed embed
- P1: Completion certificates (PDF); SEO/OG meta per course page; coach role permissions UI
- P2: Lesson reordering drag-and-drop; analytics per lesson; Vercel/Fly.io deploy config
