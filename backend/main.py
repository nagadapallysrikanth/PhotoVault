"""
main.py — PhotoVault entry point.
Registers all routers, starts the server, initialises the DB.
Adding a new feature: create a router file, import it here. That's it.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from database import init_db
from services import scanner_service
from database import SessionLocal

# ── Routers — import new ones here as phases are built ───
from routers.v1 import photos, auth, upload, share
# Phase 6: from routers.v1 import wol
# Phase 4: from routers.v1 import share
# Phase 6: from routers.v1 import wol
# Phase 7: from routers.v1 import admin
# Phase 8: from routers.v1 import ai_tagging


# ─────────────────────────────────────────────────────────
# Startup & Shutdown
# ─────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Runs on startup and shutdown."""
    print(f"\n{'─'*50}")
    print(f"  📷  {settings.APP_NAME} starting up")
    print(f"{'─'*50}")

    from services.startup_service import create_admin_if_needed
    # Init database (creates tables if they don't exist)
    init_db()
    create_admin_if_needed(SessionLocal())

    # Init storage directories
    settings.thumbnail_dir.mkdir(parents=True, exist_ok=True)
    for name, path in settings.drives.items():
        try:
            path.mkdir(parents=True, exist_ok=True)
            print(f"  ✓ Storage [{name}]: {path}")
        except Exception as e:
            print(f"  ✗ Storage [{name}] not available: {e}")

    # Auto-scan drives on startup (background — doesn't block server start)
    print("  → Auto-scanning drives for new photos...")
    db = SessionLocal()
    try:
        scanner_service.scan_all_drives(db)
    finally:
        db.close()

    print(f"\n  🚀  Running at http://{settings.APP_HOST}:{settings.APP_PORT}")
    print(f"  📖  API docs at http://localhost:{settings.APP_PORT}/docs")
    print(f"{'─'*50}\n")

    yield  # App is running

    print("\n  👋  PhotoVault shutting down\n")


# ─────────────────────────────────────────────────────────
# App
# ─────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Your private, self-hosted photo library",
    lifespan=lifespan,
    # Disable /docs in production (Phase 5)
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url=None,
)

# ── CORS — allow frontend dev server and local access ────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",    # React dev server
        "http://localhost:5000",
        "http://127.0.0.1:5000",
        # Phase 5: add your Cloudflare domain here
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────
# Register Routers
# ─────────────────────────────────────────────────────────

app.include_router(photos.router)
app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(share.router)
# Phase 6: app.include_router(wol.router)
# Phase 6: app.include_router(wol.router)
# Phase 7: app.include_router(admin.router)
# Phase 8: app.include_router(ai_tagging.router)


# ─────────────────────────────────────────────────────────
# Health check
# ─────────────────────────────────────────────────────────

@app.get("/health", tags=["system"])
def health():
    """Quick check that the server is running."""
    return {"status": "ok", "app": settings.APP_NAME}


@app.get("/", tags=["system"])
def root():
    return {
        "app":     settings.APP_NAME,
        "version": "1.0.0",
        "docs":    "/docs" if settings.DEBUG else "disabled in production",
        "api":     "/api/v1",
    }


# ─────────────────────────────────────────────────────────
# Run
# ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.APP_HOST,
        port=settings.APP_PORT,
        reload=settings.DEBUG,   # auto-restart on code changes in dev
    )
