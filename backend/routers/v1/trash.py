"""
routers/v1/trash.py
Trash bin management.
Photos stay 30 days then auto-delete.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Photo, User
from middleware.auth_middleware import require_user, require_admin
from services import trash_service

router = APIRouter(prefix="/api/v1/trash", tags=["trash"])


@router.get("")
def list_trash(
    db:    Session = Depends(get_db),
    _user: User    = Depends(require_user),
):
    """List all trashed photos."""
    photos = (
        db.query(Photo)
        .filter(Photo.is_trashed == True)
        .order_by(Photo.trashed_at.desc())
        .all()
    )
    return {
        "total":  len(photos),
        "photos": [_trash_dict(p) for p in photos],
    }


@router.post("/delete")
def trash_photos(
    photo_ids: List[str],
    db:        Session = Depends(get_db),
    _user:     User    = Depends(require_user),
):
    """Move one or more photos to trash."""
    trashed = []
    errors  = []

    for pid in photo_ids:
        photo = db.get(Photo, pid)
        if not photo:
            errors.append({"id": pid, "error": "Not found"})
            continue
        if photo.is_trashed:
            errors.append({"id": pid, "error": "Already in trash"})
            continue
        ok = trash_service.move_to_trash(photo, db)
        if ok:
            trashed.append(pid)
        else:
            errors.append({"id": pid, "error": "Failed to trash"})

    return {"trashed": len(trashed), "errors": errors}


@router.post("/restore")
def restore_photos(
    photo_ids: List[str],
    db:        Session = Depends(get_db),
    _user:     User    = Depends(require_user),
):
    """Restore one or more photos from trash."""
    restored = []
    errors   = []

    for pid in photo_ids:
        photo = db.get(Photo, pid)
        if not photo or not photo.is_trashed:
            errors.append({"id": pid, "error": "Not in trash"})
            continue
        ok = trash_service.restore_photo(photo, db)
        if ok:
            restored.append(pid)
        else:
            errors.append({"id": pid, "error": "Failed to restore"})

    return {"restored": len(restored), "errors": errors}


@router.delete("/permanent")
def permanently_delete_photos(
    photo_ids: List[str],
    db:        Session = Depends(get_db),
    _user:     User    = Depends(require_user),
):
    """Permanently delete photos — irreversible."""
    deleted = []
    errors  = []

    for pid in photo_ids:
        photo = db.get(Photo, pid)
        if not photo:
            errors.append({"id": pid, "error": "Not found"})
            continue
        ok = trash_service.permanently_delete(photo, db)
        if ok:
            deleted.append(pid)
        else:
            errors.append({"id": pid, "error": "Failed to delete"})

    return {"deleted": len(deleted), "errors": errors}


@router.delete("/empty")
def empty_trash(
    db:     Session = Depends(get_db),
    _admin: User    = Depends(require_admin),
):
    """Empty entire trash — admin only. Irreversible."""
    photos = db.query(Photo).filter(Photo.is_trashed == True).all()
    count  = 0
    for photo in photos:
        if trash_service.permanently_delete(photo, db):
            count += 1
    return {"deleted": count, "message": f"Trash emptied — {count} photos permanently deleted"}


@router.get("/stats")
def trash_stats(
    db:    Session = Depends(get_db),
    _user: User    = Depends(require_user),
):
    """Return trash statistics."""
    return trash_service.get_trash_stats(db)


def _trash_dict(p: Photo) -> dict:
    return {
        "id":           p.id,
        "filename":     p.filename,
        "album_id":     p.album_id,
        "drive":        p.drive.value if p.drive else None,
        "size_kb":      p.size_kb,
        "taken_at":     p.taken_at.isoformat() if p.taken_at else None,
        "trashed_at":   p.trashed_at.isoformat() if p.trashed_at else None,
        "thumbnail_url":f"/api/v1/photos/{p.id}/thumbnail",
    }
