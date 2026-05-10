"""
services/startup_service.py
Runs once on app startup.
- Creates admin account if no users exist
- Ensures all storage directories exist
"""

from sqlalchemy.orm import Session
from models import User, UserRole
from auth import hash_password
from config import settings


def create_admin_if_needed(db: Session):
    """
    Auto-create the admin account on first run.
    Credentials come from .env (ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_EMAIL).
    If any users already exist, does nothing.
    """
    existing = db.query(User).first()
    if existing:
        return  # already set up

    print("  -> First run detected — creating admin account...")

    admin = User(
        username      = settings.ADMIN_USERNAME,
        email         = settings.ADMIN_EMAIL,
        password_hash = hash_password(settings.ADMIN_PASSWORD),
        role          = UserRole.ADMIN,
        is_active     = True,
    )
    db.add(admin)
    db.commit()

    print(f"  [OK] Admin account created: '{settings.ADMIN_USERNAME}'")
    print(f"  [!] Change this password after first login!")
