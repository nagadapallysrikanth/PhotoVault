"""
routers/v1/albums.py
Full album management — create, rename, delete, set cover, move photos.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pathlib import Path
from typing import Optional
import shutil

from database import get_db
from models import Photo, Album, DriveType, User
from middleware.auth_middleware import require_user, require_admin
from config import settings

router = APIRouter(prefix="/api/v1/albums", tags=["albums"])


# ─────────────────────────────────────────────────────────
# List & Get
# ─────────────────────────────────────────────────────────

@router.get("")
def list_albums(
    drive:   Optional[str] = None,
    db:      Session        = Depends(get_db),
    _user:   User           = Depends(require_user),
):
    """List all albums with photo count and cover photo."""
    q = db.query(Album)
    if drive:
        q = q.filter(Album.drive == drive)
    albums = q.order_by(Album.name).all()
    return [_album_dict(a, db) for a in albums]


@router.get("/{album_id}")
def get_album(
    album_id: int,
    db:       Session = Depends(get_db),
    _user:    User    = Depends(require_user),
):
    album = db.get(Album, album_id)
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    return _album_dict(album, db)


# ─────────────────────────────────────────────────────────
# Create
# ─────────────────────────────────────────────────────────

@router.post("")
def create_album(
    name:        str,
    drive:       str = "ssd",
    description: Optional[str] = None,
    db:          Session = Depends(get_db),
    user:        User    = Depends(require_user),
):
    """Create a new album (folder on disk + DB entry)."""
    if drive not in settings.drives:
        raise HTTPException(status_code=400, detail=f"Unknown drive: {drive}")

    drive_path = settings.drives[drive]
    if not drive_path.is_dir():
        raise HTTPException(status_code=400, detail=f"Drive not available: {drive_path}")

    # Check album doesn't already exist
    existing = (
        db.query(Album)
        .filter(Album.name == name, Album.drive == drive)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Album already exists on this drive")

    # Create folder on disk
    album_dir = drive_path / name
    try:
        album_dir.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not create folder: {e}")

    album = Album(
        name          = name,
        drive         = DriveType(drive),
        description   = description,
        created_by_id = user.id,
    )
    db.add(album)
    db.commit()
    db.refresh(album)
    return _album_dict(album, db)


# ─────────────────────────────────────────────────────────
# Update
# ─────────────────────────────────────────────────────────

@router.patch("/{album_id}")
def update_album(
    album_id:    int,
    name:        Optional[str] = None,
    description: Optional[str] = None,
    db:          Session = Depends(get_db),
    _user:       User    = Depends(require_user),
):
    """Rename an album or update its description."""
    album = db.get(Album, album_id)
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    if name and name != album.name:
        # Rename folder on disk
        drive_path  = settings.drives.get(album.drive.value)
        old_dir     = drive_path / album.name
        new_dir     = drive_path / name

        if new_dir.exists():
            raise HTTPException(status_code=409, detail="An album with that name already exists")

        try:
            if old_dir.exists():
                old_dir.rename(new_dir)
            # Update filepaths for all photos in this album
            photos = db.query(Photo).filter(Photo.album_id == album_id).all()
            for photo in photos:
                old_path = Path(photo.filepath)
                new_path = new_dir / old_path.name
                photo.filepath = str(new_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Could not rename folder: {e}")

        album.name = name

    if description is not None:
        album.description = description

    db.commit()
    db.refresh(album)
    return _album_dict(album, db)


@router.patch("/{album_id}/cover")
def set_cover(
    album_id: int,
    photo_id: str,
    db:       Session = Depends(get_db),
    _user:    User    = Depends(require_user),
):
    """Set the cover photo for an album."""
    album = db.get(Album, album_id)
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    photo = db.get(Photo, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    album.cover_photo_id = photo_id
    db.commit()
    return {"message": "Cover photo updated"}


# ─────────────────────────────────────────────────────────
# Delete
# ─────────────────────────────────────────────────────────

@router.delete("/{album_id}")
def delete_album(
    album_id:      int,
    photos_action: str = "ask",   # "trash" | "uncategorized"
    db:            Session = Depends(get_db),
    _user:         User    = Depends(require_user),
):
    """
    Delete an album.
    photos_action:
      "trash"         → move all photos to trash
      "uncategorized" → move photos to Uncategorized album
    """
    album = db.get(Album, album_id)
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    photos = db.query(Photo).filter(Photo.album_id == album_id).all()

    if photos:
        if photos_action == "trash":
            from services.trash_service import move_to_trash
            for photo in photos:
                move_to_trash(photo, db)

        elif photos_action == "uncategorized":
            # Get or create Uncategorized album
            uncat = (
                db.query(Album)
                .filter(Album.name == "Uncategorized", Album.drive == album.drive)
                .first()
            )
            if not uncat:
                drive_path = settings.drives.get(album.drive.value)
                uncat_dir  = drive_path / "Uncategorized"
                uncat_dir.mkdir(exist_ok=True)
                uncat = Album(name="Uncategorized", drive=album.drive)
                db.add(uncat)
                db.commit()
                db.refresh(uncat)

            # Move photos to Uncategorized
            drive_path = settings.drives.get(album.drive.value)
            for photo in photos:
                src  = Path(photo.filepath)
                dest = drive_path / "Uncategorized" / src.name
                if src.exists():
                    shutil.move(str(src), str(dest))
                photo.filepath = str(dest)
                photo.album_id = uncat.id
            db.commit()

        else:
            raise HTTPException(
                status_code=400,
                detail="photos_action must be 'trash' or 'uncategorized'"
            )

    # Remove folder from disk if empty
    drive_path = settings.drives.get(album.drive.value)
    if drive_path:
        album_dir = drive_path / album.name
        try:
            if album_dir.exists() and not any(album_dir.iterdir()):
                album_dir.rmdir()
        except Exception:
            pass

    db.delete(album)
    db.commit()
    return {"message": f"Album '{album.name}' deleted", "photos_moved": len(photos)}


# ─────────────────────────────────────────────────────────
# Move photos between albums
# ─────────────────────────────────────────────────────────

@router.post("/move-photos")
def move_photos(
    photo_ids:        list[str],
    target_album_id:  int,
    target_drive:     Optional[str] = None,
    db:               Session = Depends(get_db),
    _user:            User    = Depends(require_user),
):
    """Move one or more photos to a different album (and optionally different drive)."""
    target_album = db.get(Album, target_album_id)
    if not target_album:
        raise HTTPException(status_code=404, detail="Target album not found")

    drive_name = target_drive or target_album.drive.value
    drive_path = settings.drives.get(drive_name)
    if not drive_path:
        raise HTTPException(status_code=400, detail="Invalid drive")

    target_dir = drive_path / target_album.name
    target_dir.mkdir(parents=True, exist_ok=True)

    moved  = []
    errors = []

    for pid in photo_ids:
        photo = db.get(Photo, pid)
        if not photo:
            errors.append({"id": pid, "error": "Not found"})
            continue

        src  = Path(photo.filepath)
        dest = target_dir / src.name

        if dest.exists():
            stem, ext = src.stem, src.suffix
            counter = 1
            while dest.exists():
                dest = target_dir / f"{stem}_{counter}{ext}"
                counter += 1

        try:
            if src.exists():
                shutil.move(str(src), str(dest))
            photo.filepath = str(dest)
            photo.album_id = target_album.id
            photo.drive    = DriveType(drive_name)
            db.commit()
            moved.append(pid)
        except Exception as e:
            errors.append({"id": pid, "error": str(e)})
            db.rollback()

    return {"moved": len(moved), "errors": errors}


# ─────────────────────────────────────────────────────────
# Helper
# ─────────────────────────────────────────────────────────

def _album_dict(album: Album, db: Session) -> dict:
    count = (
        db.query(func.count(Photo.id))
        .filter(Photo.album_id == album.id, Photo.is_trashed == False)
        .scalar()
    )
    # Get cover photo thumbnail URL
    cover_url = None
    if album.cover_photo_id:
        from config import settings as s
        cover_url = f"/api/v1/photos/{album.cover_photo_id}/thumbnail"
    elif count > 0:
        # Use first photo as cover
        first = (
            db.query(Photo)
            .filter(Photo.album_id == album.id, Photo.is_trashed == False)
            .order_by(Photo.taken_at.desc())
            .first()
        )
        if first:
            cover_url = f"/api/v1/photos/{first.id}/thumbnail"

    return {
        "id":          album.id,
        "name":        album.name,
        "drive":       album.drive.value if album.drive else None,
        "description": album.description,
        "photo_count": count,
        "cover_url":   cover_url,
        "created_at":  album.created_at.isoformat() if album.created_at else None,
    }
