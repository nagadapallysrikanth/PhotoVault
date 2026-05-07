"""
routers/v1/upload.py
Authenticated file upload for family members and admin.
Friends upload via share.py instead.
"""

import os
import hashlib
from pathlib import Path
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from typing import Optional, List

from database import get_db
from models import Photo, Album, DriveType, User
from middleware.auth_middleware import require_user
from services import thumbnail_service, notification_service
from services.scanner_service import photo_id, is_image, _get_or_create_album
from config import settings


def _secure_filename(filename: str) -> str:
    """Safe filename — strips path separators and dangerous characters."""
    filename = filename.replace("/", "_").replace("\\", "_")
    filename = "".join(c for c in filename if c.isalnum() or c in "._- ")
    return filename.strip() or "upload"

router = APIRouter(prefix="/api/v1", tags=["upload"])


@router.post("/upload")
async def upload_photos(
    files:    List[UploadFile] = File(...),
    drive:    str              = Form("ssd"),
    album:    str              = Form("Uploads"),
    db:       Session          = Depends(get_db),
    user:     User             = Depends(require_user),
):
    """
    Upload one or more photos (family/admin only).
    - drive: 'ssd' or 'external'
    - album: subfolder name (created if it doesn't exist)
    """
    if drive not in settings.drives:
        raise HTTPException(status_code=400, detail=f"Unknown drive: {drive}")

    drive_path = settings.drives[drive]
    if not drive_path.is_dir():
        raise HTTPException(status_code=400, detail=f"Drive not available: {drive_path}")

    safe_album = _secure_filename(album.strip()) or "Uploads"
    target_dir = drive_path / safe_album
    target_dir.mkdir(parents=True, exist_ok=True)

    saved  = []
    errors = []

    for file in files:
        if not file.filename:
            continue

        if not is_image(file.filename):
            errors.append({"file": file.filename, "error": "Unsupported file type"})
            continue

        # Check file size
        content = await file.read()
        if len(content) > settings.max_upload_bytes:
            errors.append({"file": file.filename, "error": f"File too large (max {settings.MAX_UPLOAD_MB}MB)"})
            continue

        safe_name = _secure_filename(file.filename)
        dest = target_dir / safe_name

        # Avoid overwriting — append counter
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

        drive_type = DriveType(drive)
        album_obj  = _get_or_create_album(db, safe_album, drive_type)

        photo = Photo(
            id             = pid,
            filename       = dest.name,
            filepath       = str(dest),
            drive          = drive_type,
            album_id       = album_obj.id,
            uploaded_by_id = user.id,
            size_kb        = round(stat.st_size / 1024, 1),
            width          = meta.get("width"),
            height         = meta.get("height"),
            taken_at       = taken_at,
            year           = str(taken_at.year),
            month          = f"{taken_at.month:02d}",
            thumbnail_ready= False,
        )
        db.add(photo)
        db.commit()

        # Generate thumbnail
        ok = await run_in_threadpool(thumbnail_service.generate_thumbnail, str(dest), pid)
        if ok:
            photo.thumbnail_ready = True
            db.commit()

        saved.append({
            "id":       pid,
            "filename": dest.name,
            "album":    safe_album,
            "drive":    drive,
            "size_kb":  photo.size_kb,
        })

    # Notify admin if a family member (not admin) uploaded
    if saved and user.role.value != "admin":
        notification_service.notify_family_upload(user.username, safe_album, len(saved))

    return {
        "saved":  saved,
        "errors": errors,
        "total":  len(saved),
    }


@router.get("/albums/available")
def available_albums(
    drive: Optional[str] = None,
    db: Session = Depends(get_db),
    _user: User = Depends(require_user),
):
    """
    Return albums available for uploading to.
    Used to populate the album dropdown in the upload form.
    """
    from models import Album as AlbumModel
    q = db.query(AlbumModel)
    if drive:
        q = q.filter(AlbumModel.drive == drive)
    albums = q.order_by(AlbumModel.name).all()
    return [{"id": a.id, "name": a.name, "drive": a.drive} for a in albums]
