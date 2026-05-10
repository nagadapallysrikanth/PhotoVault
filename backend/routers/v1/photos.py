"""
routers/v1/photos.py
All photo and album endpoints.
Version prefix /api/v1 ensures backward compatibility in the future.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from pathlib import Path
from typing import Optional

from database import get_db
from models import Photo, User
from services import scanner_service, thumbnail_service
from middleware.auth_middleware import require_user, require_admin
from config import settings

router = APIRouter(prefix="/api/v1", tags=["photos"])


# ─────────────────────────────────────────────────────────
# Photos
# ─────────────────────────────────────────────────────────

@router.get("/photos")
def list_photos(
    drive:   Optional[str] = None,
    album_id:Optional[int] = None,
    year:    Optional[str] = None,
    month:   Optional[str] = None,
    search:   Optional[str] = None,
    date_from: Optional[str] = None,
    date_to:   Optional[str] = None,
    sort:    str = Query("date", enum=["date", "name", "size"]),
    order:   str = Query("desc", enum=["asc", "desc"]),
    limit:   int = Query(100, le=500),
    offset:  int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _user: User = Depends(require_user),   # 🔐 login required
):
    """
    List photos with filtering, sorting, and pagination.
    All params are optional — no params returns all photos.
    """
    q = db.query(Photo).filter(Photo.is_trashed == False)

    if drive:
        q = q.filter(Photo.drive == drive)
    if album_id:
        q = q.filter(Photo.album_id == album_id)
    if year:
        q = q.filter(Photo.year == year)
    if month:
        q = q.filter(Photo.month == month)
    if search:
        q = q.filter(Photo.filename.ilike(f"%{search}%"))
    if date_from:
        from datetime import datetime as dt
        q = q.filter(Photo.taken_at >= dt.fromisoformat(date_from))
    if date_to:
        from datetime import datetime as dt
        q = q.filter(Photo.taken_at <= dt.fromisoformat(date_to))

    # Sort
    sort_col = {
        "date": Photo.taken_at,
        "name": Photo.filename,
        "size": Photo.size_kb,
    }[sort]

    q = q.order_by(sort_col.desc() if order == "desc" else sort_col.asc())

    total = q.count()
    photos = q.offset(offset).limit(limit).all()

    return {
        "total":  total,
        "offset": offset,
        "limit":  limit,
        "photos": [_photo_dict(p) for p in photos],
    }


@router.get("/photos/{photo_id}/thumbnail")
def get_thumbnail(
    photo_id: str,
    token: Optional[str] = None,
    db: Session = Depends(get_db),
    credentials=Depends(HTTPBearer(auto_error=False)),
):
    """
    Serve a thumbnail.
    Accepts auth via Bearer header OR ?token= query param.
    Query param needed because img tags cannot send auth headers.
    """
    from auth import decode_access_token
    raw = token or (credentials.credentials if credentials else None)
    if not raw:
        raise HTTPException(status_code=401, detail="Authentication required")
    payload = decode_access_token(raw)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.get(User, int(payload["sub"]))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")
    photo = _get_photo_or_404(photo_id, db)
    thumb_path = thumbnail_service.get_thumbnail_path(photo_id)
    if not thumb_path.exists():
        ok = thumbnail_service.generate_thumbnail(photo.filepath, photo_id)
        if not ok:
            raise HTTPException(status_code=500, detail="Thumbnail generation failed")
        photo.thumbnail_ready = True
        db.commit()
    return FileResponse(str(thumb_path), media_type="image/jpeg")


@router.get("/photos/{photo_id}/original")
def get_original(
    photo_id: str,
    token: Optional[str] = None,
    db: Session = Depends(get_db),
    credentials=Depends(HTTPBearer(auto_error=False)),
):
    """Serve the full-resolution original. Accepts token via header or query param."""
    from auth import decode_access_token
    raw = token or (credentials.credentials if credentials else None)
    if not raw:
        raise HTTPException(status_code=401, detail="Authentication required")
    payload = decode_access_token(raw)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.get(User, int(payload["sub"]))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")

    photo = _get_photo_or_404(photo_id, db)
    filepath = Path(photo.filepath)
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    suffix = filepath.suffix.lower()
    media_types = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png",  ".gif": "image/gif",
        ".webp": "image/webp", ".bmp": "image/bmp",
    }
    media_type = media_types.get(suffix, "application/octet-stream")
    return FileResponse(str(filepath), media_type=media_type)


# ─────────────────────────────────────────────────────────
# Library stats + scan trigger
# ─────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats(db: Session = Depends(get_db),
              _user: User = Depends(require_user)):   # 🔐
    """Overall library statistics — photo count, size, years, drives."""
    return scanner_service.get_stats(db)


@router.post("/scan")
def trigger_scan(
    background_tasks: BackgroundTasks,
    drive: Optional[str] = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),   # 🔐 admin only
):
    """
    Trigger a drive scan in the background.
    Returns immediately — scan runs asynchronously.
    Check /stats afterward to see new photos.
    """
    background_tasks.add_task(_run_scan, drive)
    return {"message": "Scan started in background", "drive": drive or "all"}


def _run_scan(drive: Optional[str]):
    """Background scan task — gets its own DB session."""
    from database import SessionLocal
    db = SessionLocal()
    try:
        if drive:
            drive_path = settings.drives.get(drive)
            if drive_path:
                scanner_service.scan_drive(db, drive, drive_path)
        else:
            scanner_service.scan_all_drives(db)
    finally:
        db.close()


# ─────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────

@router.patch("/photos/{photo_id}/caption")
def update_caption(
    photo_id: str,
    caption:  str,
    db:       Session = Depends(get_db),
    _user:    User    = Depends(require_user),
):
    """Update the caption for a photo."""
    photo = _get_photo_or_404(photo_id, db)
    photo.caption = caption.strip() or None
    db.commit()
    return {"photo_id": photo_id, "caption": photo.caption}


@router.get("/photos/{photo_id}/exif")
def get_exif(
    photo_id: str,
    db:       Session = Depends(get_db),
    _user:    User    = Depends(require_user),
):
    """Return full EXIF metadata for a photo."""
    photo = _get_photo_or_404(photo_id, db)
    try:
        from PIL import Image, ExifTags
        exif_data = {}
        with Image.open(photo.filepath) as img:
            raw = img._getexif()
            if raw:
                for tag_id, value in raw.items():
                    tag = ExifTags.TAGS.get(tag_id, str(tag_id))
                    if isinstance(value, (str, int, float)):
                        exif_data[tag] = value
        return {"photo_id": photo_id, "exif": exif_data}
    except Exception as e:
        return {"photo_id": photo_id, "exif": {}, "error": str(e)}


def _get_photo_or_404(photo_id: str, db: Session) -> Photo:
    photo = db.get(Photo, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    return photo


def _photo_dict(p: Photo) -> dict:
    return {
        "id":              p.id,
        "filename":        p.filename,
        "drive":           p.drive,
        "album_id":        p.album_id,
        "size_kb":         p.size_kb,
        "width":           p.width,
        "height":          p.height,
        "taken_at":        p.taken_at.isoformat() if p.taken_at else None,
        "year":            p.year,
        "month":           p.month,
        "thumbnail_ready": p.thumbnail_ready,
        "thumbnail_url":   f"/api/v1/photos/{p.id}/thumbnail",
        "original_url":    f"/api/v1/photos/{p.id}/original",
        "caption":         p.caption,
        "is_trashed":      p.is_trashed,
    }


