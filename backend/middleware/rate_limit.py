"""
middleware/rate_limit.py
Tracks failed login attempts and locks out IPs/usernames.
Uses the DB so lockouts survive server restarts.
"""

from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, Request

from models import LoginAttempt
from config import settings


def record_attempt(db: Session, identifier: str, success: bool):
    """Record a login attempt (success or failure)."""
    attempt = LoginAttempt(
        identifier   = identifier,
        attempted_at = datetime.now(timezone.utc),
        success      = success,
    )
    db.add(attempt)
    db.commit()


def is_locked_out(db: Session, identifier: str) -> bool:
    """
    Return True if this identifier (IP or username) is locked out.
    Counts failed attempts in the last LOCKOUT_MINUTES window.
    """
    window_start = datetime.now(timezone.utc) - timedelta(
        minutes=settings.LOCKOUT_MINUTES
    )
    failed = (
        db.query(LoginAttempt)
        .filter(
            LoginAttempt.identifier   == identifier,
            LoginAttempt.success      == False,
            LoginAttempt.attempted_at >= window_start,
        )
        .count()
    )
    return failed >= settings.MAX_LOGIN_ATTEMPTS


def clear_attempts(db: Session, identifier: str):
    """Clear failed attempts after a successful login."""
    db.query(LoginAttempt).filter(
        LoginAttempt.identifier == identifier,
        LoginAttempt.success    == False,
    ).delete()
    db.commit()


def get_client_ip(request: Request) -> str:
    """
    Get the real client IP, accounting for Cloudflare proxy headers.
    Cloudflare adds CF-Connecting-IP with the real visitor IP.
    """
    # Cloudflare real IP
    cf_ip = request.headers.get("CF-Connecting-IP")
    if cf_ip:
        return cf_ip
    # Standard forward header
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    # Direct connection
    return request.client.host if request.client else "unknown"


def check_rate_limit(db: Session, request: Request, username: str):
    """
    Call at the start of a login attempt.
    Raises HTTP 429 if locked out by IP or username.
    """
    ip = get_client_ip(request)

    if is_locked_out(db, ip):
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed attempts from your IP. "
                   f"Try again in {settings.LOCKOUT_MINUTES} minutes.",
        )

    if is_locked_out(db, username.lower()):
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed attempts for this account. "
                   f"Try again in {settings.LOCKOUT_MINUTES} minutes.",
        )
