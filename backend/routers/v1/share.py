"""
routers/v1/share.py
Share link management and guest (friend) upload endpoint.
Friends access via token — no account, no login.
"""

import secrets
import os
from pathlib import Path
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from typing import List, Optional

from database import get_db
from models import ShareLink, SharePermission, Album, Photo, DriveType, User
from middleware.auth_middleware import require_user, validate_share_token
from schemas import ShareLinkCreate, ShareLinkResponse
from services import thumbnail_service, notification_service
from services.scanner_service import photo_id, is_image, _get_or_create_album
from config import settings


def _secure_filename(filename: str) -> str:
    """Safe filename — strips path separators and dangerous characters."""
    filename = filename.replace("/", "_").replace("\\", "_")
    filename = "".join(c for c in filename if c.isalnum() or c in "._- ")
    return filename.strip() or "upload"

router = APIRouter(prefix="/api/v1/share", tags=["share"])


# ─────────────────────────────────────────────────────────
# Share link management (authenticated users only)
# ─────────────────────────────────────────────────────────

@router.post("/links", response_model=ShareLinkResponse)
def create_share_link(
    body: ShareLinkCreate,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_user),
):
    """Create a share link for friends to upload to a specific album."""
    album = db.get(Album, body.album_id)
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    token      = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=body.expires_days)

    link = ShareLink(
        token         = token,
        album_id      = body.album_id,
        created_by_id = user.id,
        label         = body.label,
        permissions   = SharePermission(body.permissions),
        expires_at    = expires_at,
        max_uploads   = body.max_uploads,
    )
    db.add(link)
    db.commit()
    db.refresh(link)

    base_url = settings.PUBLIC_URL or f"http://localhost:3000"
    return ShareLinkResponse(
        token        = link.token,
        label        = link.label,
        permissions  = link.permissions.value,
        expires_at   = link.expires_at,
        max_uploads  = link.max_uploads,
        upload_count = link.upload_count,
        is_active    = link.is_active,
        url          = f"{base_url}/upload/{link.token}",
    )


@router.get("/links")
def list_share_links(
    db:   Session = Depends(get_db),
    user: User    = Depends(require_user),
):
    """List all share links created by this user."""
    links = (
        db.query(ShareLink)
        .filter(ShareLink.created_by_id == user.id)
        .order_by(ShareLink.created_at.desc())
        .all()
    )
    base_url = settings.PUBLIC_URL or "http://localhost:3000"
    return [
        {
            "id":           l.id,
            "token":        l.token,
            "label":        l.label,
            "permissions":  l.permissions.value,
            "album_id":     l.album_id,
            "expires_at":   l.expires_at.isoformat() if l.expires_at else None,
            "max_uploads":  l.max_uploads,
            "upload_count": l.upload_count,
            "is_active":    l.is_active,
            "url":          f"{base_url}/upload/{l.token}",
        }
        for l in links
    ]


@router.delete("/links/{link_id}")
def deactivate_share_link(
    link_id: int,
    db:      Session = Depends(get_db),
    user:    User    = Depends(require_user),
):
    """Deactivate a share link so it can no longer be used."""
    link = db.get(ShareLink, link_id)
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    if link.created_by_id != user.id:
        raise HTTPException(status_code=403, detail="Not your link")

    link.is_active = False
    db.commit()
    return {"message": "Link deactivated"}


# ─────────────────────────────────────────────────────────
# Guest endpoints — no login required, token in URL
# ─────────────────────────────────────────────────────────

@router.get("/guest/{token}")
def validate_guest_link(token: str, db: Session = Depends(get_db)):
    """
    Validate a share link and return its details.
    Called when a friend opens the link — shows album name and permissions.
    """
    link  = validate_share_token(token, db, required_permission="upload_only")
    album = db.get(Album, link.album_id)

    return {
        "valid":        True,
        "label":        link.label,
        "permissions":  link.permissions.value,
        "album_name":   album.name if album else "Shared Album",
        "expires_at":   link.expires_at.isoformat() if link.expires_at else None,
        "uploads_left": (link.max_uploads - link.upload_count) if link.max_uploads else None,
    }


@router.get("/guest/{token}/photos")
def get_shared_album_photos(
    token: str,
    db:    Session = Depends(get_db),
):
    """
    Return photos in the shared album (only for view_and_upload links).
    Friends can see what others have already uploaded to this event.
    """
    link = validate_share_token(token, db, required_permission="view_and_upload")

    photos = (
        db.query(Photo)
        .filter(Photo.album_id == link.album_id)
        .order_by(Photo.taken_at.desc())
        .limit(200)
        .all()
    )

    tok = token  # use share token for image URLs
    return {
        "album_id": link.album_id,
        "photos": [
            {
                "id":            p.id,
                "filename":      p.filename,
                "taken_at":      p.taken_at.isoformat() if p.taken_at else None,
                "thumbnail_url": f"/api/v1/share/guest/{tok}/thumbnail/{p.id}",
            }
            for p in photos
        ],
    }


@router.get("/guest/{token}/thumbnail/{photo_id}")
def get_shared_thumbnail(token: str, photo_id: str, db: Session = Depends(get_db)):
    """Serve thumbnails to friends with view_and_upload links."""
    from fastapi.responses import FileResponse

    link = validate_share_token(token, db, required_permission="view_and_upload")

    photo = db.get(Photo, photo_id)
    if not photo or photo.album_id != link.album_id:
        raise HTTPException(status_code=404, detail="Photo not found")

    thumb_path = thumbnail_service.get_thumbnail_path(photo_id)
    if not thumb_path.exists():
        thumbnail_service.generate_thumbnail(photo.filepath, photo_id)

    from fastapi.responses import FileResponse
    return FileResponse(str(thumb_path), media_type="image/jpeg")


@router.post("/guest/{token}/upload")
async def guest_upload(
    token:  str,
    files:  List[UploadFile] = File(...),
    db:     Session           = Depends(get_db),
):
    """
    Friend upload endpoint — no login required, token validates access.
    Photos go directly into the album linked to the share token.
    """
    link  = validate_share_token(token, db, required_permission="upload_only")
    album = db.get(Album, link.album_id)
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    drive_path = settings.drives.get(album.drive.value)
    if not drive_path or not drive_path.is_dir():
        raise HTTPException(status_code=400, detail="Storage not available")

    target_dir = drive_path / album.name
    target_dir.mkdir(parents=True, exist_ok=True)

    saved  = []
    errors = []

    for file in files:
        if not file.filename:
            continue

        if not is_image(file.filename):
            errors.append({"file": file.filename, "error": "Unsupported file type"})
            continue

        content = await file.read()
        if len(content) > settings.max_upload_bytes:
            errors.append({"file": file.filename, "error": f"File too large (max {settings.MAX_UPLOAD_MB}MB)"})
            continue

        safe_name = _secure_filename(file.filename)
        dest = target_dir / safe_name

        if dest.exists():
            stem, ext = Path(safe_name).stem, Path(safe_name).suffix
            counter = 1
            while dest.exists():
                dest = target_dir / f"{stem}_{counter}{ext}"
                counter += 1

        try:
            dest.write_bytes(content)
        except Exception as e:
            errors.append({"file": file.filename, "error": str(e)})
            continue

        pid  = photo_id(str(dest))
        stat = dest.stat()
        meta = await run_in_threadpool(thumbnail_service.get_image_metadata, str(dest))
        taken_at = meta.get("taken_at") or datetime.fromtimestamp(stat.st_mtime)

        photo = Photo(
            id              = pid,
            filename        = dest.name,
            filepath        = str(dest),
            drive           = album.drive,
            album_id        = album.id,
            uploaded_by_id  = None,   # guest — no user account
            size_kb         = round(stat.st_size / 1024, 1),
            width           = meta.get("width"),
            height          = meta.get("height"),
            taken_at        = taken_at,
            year            = str(taken_at.year),
            month           = f"{taken_at.month:02d}",
            thumbnail_ready = False,
        )
        db.add(photo)
        db.commit()

        ok = await run_in_threadpool(thumbnail_service.generate_thumbnail, str(dest), pid)
        if ok:
            photo.thumbnail_ready = True
            db.commit()

        saved.append({"id": pid, "filename": dest.name})

    # Increment upload count on the share link
    if saved:
        link.upload_count += len(saved)
        db.commit()

        # Notify you that a friend uploaded
        notification_service.notify_friend_upload(
            album_name  = album.name,
            file_count  = len(saved),
            share_label = link.label or "Shared link",
        )

    return {
        "saved":  saved,
        "errors": errors,
        "total":  len(saved),
    }
