"""
routers/v1/auth.py
All authentication endpoints.

Public endpoints (no login needed):
  POST /api/v1/auth/login
  POST /api/v1/auth/refresh
  GET  /api/v1/auth/invite/{token}       — validate invite before showing form
  POST /api/v1/auth/register             — family self-registration via invite

Protected endpoints (login required):
  GET  /api/v1/auth/me                   — current user info
  POST /api/v1/auth/logout
  POST /api/v1/auth/change-password
  POST /api/v1/auth/invite               — admin: create family invite link
"""

import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from database import get_db
from models import User, UserRole, InviteLink
from auth import hash_password, verify_password, create_access_token, create_refresh_token, decode_refresh_token
from middleware.auth_middleware import require_user, require_admin
from middleware.rate_limit import check_rate_limit, record_attempt, clear_attempts, get_client_ip
from schemas import (
    LoginRequest, TokenResponse, RefreshRequest,
    ChangePasswordRequest, UserResponse,
    InviteLinkCreate, InviteLinkResponse,
    RegisterViaInvite,
)
from config import settings

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


# ─────────────────────────────────────────────────────────
# Login
# ─────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """
    Authenticate with username + password.
    Returns access token (15 min) and refresh token (7 days).
    Locked out after 5 failed attempts per IP and per username.
    """
    ip = get_client_ip(request)

    # Check rate limit before doing anything
    check_rate_limit(db, request, body.username)

    user = db.query(User).filter(
        User.username == body.username.strip().lower()
    ).first()

    if not user or not verify_password(body.password, user.password_hash):
        # Record failure for both IP and username
        record_attempt(db, ip, success=False)
        record_attempt(db, body.username.lower(), success=False)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled. Contact admin.",
        )

    # Success — clear failed attempts, update last login
    clear_attempts(db, ip)
    clear_attempts(db, body.username.lower())
    user.last_login = datetime.now(timezone.utc)
    db.commit()

    return TokenResponse(
        access_token  = create_access_token(user.id, user.role.value),
        refresh_token = create_refresh_token(user.id),
        expires_in    = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# ─────────────────────────────────────────────────────────
# Refresh token
# ─────────────────────────────────────────────────────────

@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    """
    Exchange a refresh token for a new access token.
    Called automatically by the frontend when the access token expires.
    """
    payload = decode_refresh_token(body.refresh_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token. Please log in again.",
        )

    user = db.get(User, int(payload["sub"]))
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or disabled",
        )

    return TokenResponse(
        access_token  = create_access_token(user.id, user.role.value),
        refresh_token = create_refresh_token(user.id),  # rotate refresh token
        expires_in    = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# ─────────────────────────────────────────────────────────
# Current user
# ─────────────────────────────────────────────────────────

@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(require_user)):
    """Return the currently logged-in user's profile."""
    return user


@router.post("/logout")
def logout(user: User = Depends(require_user)):
    """
    Logout the current user.
    Since JWTs are stateless, logout is handled client-side
    by deleting the stored tokens. This endpoint confirms the action.
    Phase 7: add token blacklist for stricter logout.
    """
    return {"message": f"Goodbye, {user.username}"}


# ─────────────────────────────────────────────────────────
# Change password
# ─────────────────────────────────────────────────────────

@router.post("/change-password")
def change_password(
    body: ChangePasswordRequest,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """Change the current user's password."""
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"message": "Password changed successfully"}


# ─────────────────────────────────────────────────────────
# Invite links — family self-registration
# ─────────────────────────────────────────────────────────

@router.post("/invite", response_model=InviteLinkResponse)
def create_invite(
    body: InviteLinkCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Admin creates an invite link to send to a family member.
    Link expires after body.expires_hours (default 48h).
    """
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=body.expires_hours)

    invite = InviteLink(
        token         = token,
        label         = body.label,
        created_by_id = admin.id,
        expires_at    = expires_at,
    )
    db.add(invite)
    db.commit()

    base_url = settings.PUBLIC_URL or f"http://localhost:{settings.APP_PORT}"
    return InviteLinkResponse(
        token      = token,
        label      = body.label,
        expires_at = expires_at,
        url        = f"{base_url}/register?invite={token}",
    )


@router.get("/invite/{token}")
def validate_invite(token: str, db: Session = Depends(get_db)):
    """
    Validate an invite token before showing the registration form.
    Returns invite details if valid, 404/410 if not.
    """
    invite = db.query(InviteLink).filter(
        InviteLink.token     == token,
        InviteLink.is_active == True,
    ).first()

    if not invite:
        raise HTTPException(status_code=404, detail="Invalid invite link")

    if invite.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="This invite link has expired")

    if invite.used_at:
        raise HTTPException(status_code=410, detail="This invite link has already been used")

    return {
        "valid":      True,
        "label":      invite.label,
        "expires_at": invite.expires_at,
    }


@router.post("/register", response_model=UserResponse)
def register_via_invite(body: RegisterViaInvite, db: Session = Depends(get_db)):
    """
    Family member registers using an invite link.
    One invite = one account. Link is disabled after use.
    """
    invite = db.query(InviteLink).filter(
        InviteLink.token     == body.token,
        InviteLink.is_active == True,
    ).first()

    if not invite:
        raise HTTPException(status_code=404, detail="Invalid invite link")

    if invite.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="This invite link has expired")

    if invite.used_at:
        raise HTTPException(status_code=410, detail="This invite link has already been used")

    # Check username/email not already taken
    username = body.username.strip().lower()
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=409, detail="Username already taken")

    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    # Create the family account
    user = User(
        username      = username,
        email         = body.email,
        password_hash = hash_password(body.password),
        role          = UserRole.FAMILY,
    )
    db.add(user)
    db.flush()  # get user.id before committing

    # Mark invite as used
    invite.used_by_id = user.id
    invite.used_at    = datetime.now(timezone.utc)
    invite.is_active  = False
    db.commit()
    db.refresh(user)

    return user
