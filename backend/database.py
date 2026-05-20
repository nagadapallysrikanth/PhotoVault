"""
database.py — Database connection setup.
To switch from SQLite to PostgreSQL in the future:
  1. pip install psycopg2-binary
  2. Change DATABASE_URL in .env to:
     postgresql://user:password@localhost/photovault
  3. That's it — nothing else changes.
"""

from sqlalchemy import create_engine, event, inspect, text
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

def upgrade_sqlite_schema():
    """Add any missing SQLite columns for simple schema upgrades."""
    if engine.dialect.name != "sqlite":
        return

    inspector = inspect(engine)
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if table.name not in inspector.get_table_names():
                continue

            existing = {col["name"] for col in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name in existing:
                    continue
                if not column.nullable and column.default is None and column.server_default is None:
                    print(f"  ⚠️  Skipping schema migration for {table.name}.{column.name} because it is required and has no default")
                    continue

                col_type = column.type.compile(engine.dialect)
                sql = f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {col_type}'
                if not column.nullable:
                    sql += " NOT NULL"
                if column.server_default is not None:
                    sql += f" DEFAULT {column.server_default.arg}"

                conn.execute(text(sql))
                print(f"  ✓ Added missing column {table.name}.{column.name}")


def init_db():
    Base.metadata.create_all(bind=engine)
    upgrade_sqlite_schema()
    print(f"  ✓ Database ready: {DB_PATH}")
