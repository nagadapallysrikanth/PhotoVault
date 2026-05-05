"""
database.py — Database connection setup.
To switch from SQLite to PostgreSQL in the future:
  1. pip install psycopg2-binary
  2. Change DATABASE_URL in .env to:
     postgresql://user:password@localhost/photovault
  3. That's it — nothing else changes.
"""

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from pathlib import Path

from config import settings
from models import Base

# ─────────────────────────────────────────────────────────
# Database URL
# ─────────────────────────────────────────────────────────

# SQLite stored alongside the thumbnails cache
DB_DIR = settings.thumbnail_dir.parent
DB_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DB_DIR / "photovault.db"

DATABASE_URL = f"sqlite:///{DB_PATH}"


# ─────────────────────────────────────────────────────────
# Engine
# ─────────────────────────────────────────────────────────

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # needed for SQLite + FastAPI
    echo=settings.DEBUG,                         # log SQL in debug mode
)

# Enable WAL mode for SQLite — better performance, prevents corruption
@event.listens_for(engine, "connect")
def set_sqlite_pragmas(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")    # Write-Ahead Logging
    cursor.execute("PRAGMA foreign_keys=ON")     # Enforce FK constraints
    cursor.execute("PRAGMA synchronous=NORMAL")  # Balance safety/speed
    cursor.close()


# ─────────────────────────────────────────────────────────
# Session factory
# ─────────────────────────────────────────────────────────

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)


# ─────────────────────────────────────────────────────────
# FastAPI dependency — use in any route with:
#   db: Session = Depends(get_db)
# ─────────────────────────────────────────────────────────

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─────────────────────────────────────────────────────────
# Init — creates all tables if they don't exist
# ─────────────────────────────────────────────────────────

def init_db():
    Base.metadata.create_all(bind=engine)
    print(f"  ✓ Database ready: {DB_PATH}")
