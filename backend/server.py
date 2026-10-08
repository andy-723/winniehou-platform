from core import client, db, init_storage, logger
import os
import logging
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from routers import auth, courses, payments, content, admin
from seed import seed_admin, seed_demo, seed_services, ensure_indexes

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")

app = FastAPI(title="Winnie Hou LMS API")

app.include_router(auth.router)
app.include_router(courses.router)
app.include_router(payments.router)
app.include_router(content.router)
app.include_router(admin.router)


@app.get("/api/health")
async def health():
    return {"ok": True}


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_origin_regex=r"https?://.*",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await ensure_indexes()
    await seed_admin()
    await seed_demo()
    await seed_services()
    try:
        init_storage()
        logger.info("Object storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")


@app.on_event("shutdown")
async def shutdown():
    client.close()
