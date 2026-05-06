"""
auth.py — Core authentication logic.
JWT creation/validation and password hashing live here.
Nothing else should import jose or passlib directly.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext

from config import settings

# ─────────────────────────────────────────────────────────
# Password hashing
# ─────────────────────────────────────────────────────────

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    """Hash a plaintext password with bcrypt."""
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    return _pwd_context.verify(plain, hashed)


# ─────────────────────────────────────────────────────────
# JWT tokens
# ─────────────────────────────────────────────────────────

ALGORITHM = "HS256"


def create_access_token(user_id: int, role: str) -> str:
    """
    Short-lived token (15 min default).
    Sent with every request in the Authorization header.
    """
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub":  str(user_id),
        "role": role,
        "type": "access",
        "exp":  expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(user_id: int) -> str:
    """
    Long-lived token (7 days default).
    Used only to get a new access token. Stored securely by the client.
    """
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    payload = {
        "sub":  str(user_id),
        "type": "refresh",
        "exp":  expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """
    Decode and validate a JWT token.
    Returns the payload dict or None if invalid/expired.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and validate specifically an access token."""
    payload = decode_token(token)
    if payload and payload.get("type") == "access":
        return payload
    return None


def decode_refresh_token(token: str) -> Optional[dict]:
    """Decode and validate specifically a refresh token."""
    payload = decode_token(token)
    if payload and payload.get("type") == "refresh":
        return payload
    return None
