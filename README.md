# Winnie Hou platform

Business English LMS: FastAPI API, React frontend, MongoDB.

## Run locally with Docker

From this directory:

```bash
docker compose up --build
```

Published ports (chosen so they do not collide with 3000, 5173, or 8080):

- UI: http://127.0.0.1:43123
- API: http://127.0.0.1:43124 (also proxied at http://127.0.0.1:43123/api)

MongoDB stays on the Compose network and is not published to the host.

Stop with `docker compose down`. Data is kept in the `mongo-data` volume.

## Local admin

On startup the API seeds an admin user from the environment:

- email: `admin@localhost`
- password: `local-admin-password`

Change `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `JWT_SECRET` before any shared or public use. Copy `env.example` to `.env` to override them. `.env` is gitignored.

## What works without extra credentials

Catalog, blog, auth, admin CMS, and seeded courses run with the defaults. Stripe uses the app's existing test-key fallback when `STRIPE_SECRET_KEY` is empty, so live charges are not configured. Bunny Stream upload and Emergent email/Claude resume parsing need their own keys (`BUNNY_*`, `EMERGENT_EMAIL_KEY`, `EMERGENT_LLM_KEY`). `emergentintegrations` is not published on PyPI, so the image omits it and the private `litellm` wheel; the API still starts, and resume parsing fails until that package is installed with a key.

Auth cookies are marked `Secure`, so over plain HTTP the UI uses the bearer token returned by login (stored in localStorage).
