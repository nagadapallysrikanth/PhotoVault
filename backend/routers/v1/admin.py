"""
routers/v1/admin.py
Admin-only endpoints.
All routes require admin role — regular family members get 403.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone
from typing import Optional

from database import get_db
from models import User, UserRole, Photo, Album, ShareLink, InviteLink, LoginAttempt
from middleware.auth_middleware import require_admin
from auth import hash_password
from schemas import UserCreate, InviteLinkCreate, InviteLinkResponse
import secrets

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


# ─────────────────────────────────────────────────────────
# Dashboard stats
# ─────────────────────────────────────────────────────────

@router.get("/dashboard")
def dashboard(
    admin: User   = Depends(require_admin),
    db: Session   = Depends(get_db),
):
    """
    Admin dashboard — overview of the entire library.
    Returns user count, photo count, storage, recent activity.
    """
    from config import settings

    # User stats
    total_users  = db.query(func.count(User.id)).scalar()
    active_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar()

    # Photo stats
    total_photos = db.query(func.count(Photo.id)).scalar()
    total_size   = db.query(func.sum(Photo.size_kb)).scalar() or 0

    # Per-drive stats
    drive_stats = []
    for drive_name, drive_path in settings.drives.items():
        from models import DriveType
        try:
            dt = DriveType(drive_name)
        except ValueError:
            continue
        count = db.query(func.count(Photo.id)).filter(Photo.drive == dt).scalar()
        size  = db.query(func.sum(Photo.size_kb)).filter(Photo.drive == dt).scalar() or 0
        drive_stats.append({
            "drive":     drive_name,
            "path":      str(drive_path),
            "available": drive_path.is_dir(),
            "photos":    count,
            "size_gb":   round(size / (1024 * 1024), 2),
        })

    # Active share links
    active_links = db.query(func.count(ShareLink.id)).filter(
        ShareLink.is_active == True
    ).scalar()

    # Recent uploads (last 10)
    recent = (
        db.query(Photo)
        .order_by(Photo.created_at.desc())
        .limit(10)
        .all()
    )

    return {
        "users": {
            "total":  total_users,
            "active": active_users,
        },
        "photos": {
            "total":    total_photos,
            "size_gb":  round(total_size / (1024 * 1024), 2),
        },
        "drives":       drive_stats,
        "share_links":  {"active": active_links},
        "recent_uploads": [
            {
                "id":          p.id,
                "filename":    p.filename,
                "album":       p.album.name if p.album else "—",
                "drive":       p.drive,
                "size_kb":     p.size_kb,
                "uploaded_by": p.uploaded_by_user.username if p.uploaded_by_user else "guest",
                "created_at":  p.created_at.isoformat() if p.created_at else None,
            }
            for p in recent
        ],
    }


# ─────────────────────────────────────────────────────────
# User management
# ─────────────────────────────────────────────────────────

@router.get("/users")
def list_users(
    admin: User   = Depends(require_admin),
    db: Session   = Depends(get_db),
):
    """List all users with their stats."""
    users = db.query(User).order_by(User.created_at).all()
    return [_user_dict(u, db) for u in users]


@router.get("/users/{user_id}")
def get_user(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Get a single user's details."""
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_dict(user, db)


@router.post("/users")
def create_user(
    body: UserCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin creates a user directly (without invite link)."""
    if db.query(User).filter(User.username == body.username.lower()).first():
        raise HTTPException(status_code=409, detail="Username already taken")
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        username      = body.username.strip().lower(),
        email         = body.email,
        password_hash = hash_password(body.password),
        role          = body.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _user_dict(user, db)


@router.patch("/users/{user_id}/toggle")
def toggle_user(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Enable or disable a user account."""
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot disable your own account")

    user.is_active = not user.is_active
    db.commit()
    return {
        "user_id":   user.id,
        "username":  user.username,
        "is_active": user.is_active,
        "message":   f"Account {'enabled' if user.is_active else 'disabled'}",
    }


@router.patch("/users/{user_id}/role")
def change_role(
    user_id: int,
    role: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Change a user's role."""
    if role not in [r.value for r in UserRole]:
        raise HTTPException(status_code=400, detail=f"Invalid role: {role}")

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    user.role = UserRole(role)
    db.commit()
    return {"user_id": user.id, "username": user.username, "role": user.role}


# ─────────────────────────────────────────────────────────
# Invite links
# ─────────────────────────────────────────────────────────

@router.post("/invite", response_model=InviteLinkResponse)
def create_invite(
    body:  InviteLinkCreate,
    admin: User    = Depends(require_admin),
    db:    Session = Depends(get_db),
):
    """Create a family invite link."""
    from datetime import timedelta
    token      = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=body.expires_hours)

    invite = InviteLink(
        token         = token,
        label         = body.label,
        created_by_id = admin.id,
        expires_at    = expires_at,
    )
    db.add(invite)
    db.commit()

    from config import settings
    base_url = settings.PUBLIC_URL or f"http://localhost:3000"
    return InviteLinkResponse(
        token      = token,
        label      = body.label,
        expires_at = expires_at,
        url        = f"{base_url}/register?invite={token}",
    )


@router.get("/invites")
def list_invites(
    admin: User   = Depends(require_admin),
    db: Session   = Depends(get_db),
):
    """List all invite links."""
    from config import settings
    base_url = settings.PUBLIC_URL or "http://localhost:3000"
    invites  = db.query(InviteLink).order_by(InviteLink.created_at.desc()).all()
    return [
        {
            "id":         i.id,
            "label":      i.label,
            "token":      i.token,
            "url":        f"{base_url}/register?invite={i.token}",
            "expires_at": i.expires_at.isoformat(),
            "used":       i.used_at is not None,
            "used_by":    i.used_by.username if i.used_by else None,
            "is_active":  i.is_active,
        }
        for i in invites
    ]


# ─────────────────────────────────────────────────────────
# Share link management
# ─────────────────────────────────────────────────────────

@router.get("/share-links")
def list_all_share_links(
    admin: User   = Depends(require_admin),
    db: Session   = Depends(get_db),
):
    """List ALL share links across all users (admin view)."""
    from config import settings
    base_url = settings.PUBLIC_URL or "http://localhost:3000"
    links    = db.query(ShareLink).order_by(ShareLink.created_at.desc()).all()
    return [
        {
            "id":           l.id,
            "label":        l.label,
            "permissions":  l.permissions.value,
            "album":        l.album.name if l.album else "—",
            "created_by":   l.created_by_user.username if l.created_by_user else "—",
            "expires_at":   l.expires_at.isoformat() if l.expires_at else None,
            "upload_count": l.upload_count,
            "max_uploads":  l.max_uploads,
            "is_active":    l.is_active,
            "url":          f"{base_url}/upload/{l.token}",
        }
        for l in links
    ]


@router.delete("/share-links/{link_id}")
def force_deactivate_link(
    link_id: int,
    admin:   User    = Depends(require_admin),
    db:      Session = Depends(get_db),
):
    """Admin can deactivate any share link."""
    link = db.get(ShareLink, link_id)
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    link.is_active = False
    db.commit()
    return {"message": f"Share link '{link.label}' deactivated"}


# ─────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────

def _user_dict(user: User, db: Session) -> dict:
    photo_count = db.query(func.count(Photo.id)).filter(
        Photo.uploaded_by_id == user.id
    ).scalar()
    return {
        "id":          user.id,
        "username":    user.username,
        "email":       user.email,
        "role":        user.role.value,
        "is_active":   user.is_active,
        "created_at":  user.created_at.isoformat() if user.created_at else None,
        "last_login":  user.last_login.isoformat() if user.last_login else None,
        "photo_count": photo_count,
    }
