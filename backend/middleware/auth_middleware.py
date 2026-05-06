"""
middleware/auth_middleware.py
FastAPI dependencies for protecting routes.

Usage in any router:
    # Require any logged-in user
    user: User = Depends(require_user)

    # Require admin only
    user: User = Depends(require_admin)

    # Allow friend access via share link token
    context = Depends(require_share_link("view_and_upload"))
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone

from database import get_db
from models import User, ShareLink
from auth import decode_access_token

_bearer = HTTPBearer(auto_error=False)


# ─────────────────────────────────────────────────────────
# Core: extract user from JWT
# ─────────────────────────────────────────────────────────

def _get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """
    Extract and validate the JWT from the Authorization header.
    Returns the User or None (does not raise — callers decide).
    """
    if not credentials:
        return None

    payload = decode_access_token(credentials.credentials)
    if not payload:
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    user = db.get(User, int(user_id))
    if not user or not user.is_active:
        return None

    return user


# ─────────────────────────────────────────────────────────
# Public dependencies — use these in routers
# ─────────────────────────────────────────────────────────

def require_user(
    user: Optional[User] = Depends(_get_current_user),
) -> User:
    """Require any authenticated user (admin or family). Raises 401 if not logged in."""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_admin(
    user: User = Depends(require_user),
) -> User:
    """Require admin role. Raises 403 if logged in but not admin."""
    if user.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user


def get_optional_user(
    user: Optional[User] = Depends(_get_current_user),
) -> Optional[User]:
    """
    Returns user if logged in, None if not.
    Use on endpoints accessible to both authenticated users and share-link guests.
    """
    return user


# ─────────────────────────────────────────────────────────
# Share link validation — for friend access (no account)
# ─────────────────────────────────────────────────────────

def validate_share_token(token: str, db: Session, required_permission: str) -> ShareLink:
    """
    Validate a share link token and check it has the required permission.
    required_permission: "upload_only" | "view_and_upload"
    """
    link = (
        db.query(ShareLink)
        .filter(ShareLink.token == token, ShareLink.is_active == True)
        .first()
    )

    if not link:
        raise HTTPException(status_code=404, detail="Invalid or expired share link")

    # Check expiry
    if link.expires_at and link.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="This share link has expired")

    # Check upload limit
    if link.max_uploads and link.upload_count >= link.max_uploads:
        raise HTTPException(status_code=410, detail="This share link has reached its upload limit")

    # Check permission level
    # view_and_upload links also satisfy upload_only requirements
    if required_permission == "view_and_upload" and link.permissions != "view_and_upload":
        raise HTTPException(status_code=403, detail="This link does not allow viewing")

    return link
