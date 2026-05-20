"""
services/trash_service.py
Manages photo trash bin.
Photos are moved to a .Trash folder on disk and marked in DB.
Auto-deletes after 30 days.
"""

import os
import shutil
from pathlib import Path
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func

from models import Photo, Album, DriveType
from config import settings


def move_to_trash(photo: Photo, db: Session) -> bool:
    """
    Move a photo to the .Trash folder on its drive.
    Marks it as trashed in DB with timestamp.
    Returns True on success.
    """
    try:
        drive_path = settings.drives.get(photo.drive.value)
        print(f"drive_path for {photo.drive.value}: {drive_path}")
        if not drive_path:
            print("drive_path is None")
            return False

        trash_dir = drive_path / ".Trash"
        print(f"trash_dir: {trash_dir}")
        trash_dir.mkdir(exist_ok=True)
        print("mkdir done")

        src  = Path(photo.filepath)
        dest = trash_dir / src.name

        # Avoid name collision in trash
        if dest.exists():
            stem, ext = src.stem, src.suffix
            counter = 1
            while dest.exists():
                dest = trash_dir / f"{stem}_{counter}{ext}"
                counter += 1

        print(f"src exists: {src.exists()}")
        if src.exists():
            shutil.move(str(src), str(dest))
            photo.filepath = str(dest)
        else:
            # File already missing, just mark as trashed
            pass

        # Update DB
        photo.trashed_at  = datetime.now(timezone.utc)
        photo.is_trashed  = True
        db.commit()
        print("committed")
        return True

    except Exception as e:
        print(f"  ✗ Trash failed for {photo.filename}: {e}")
        db.rollback()
        return False


def restore_photo(photo: Photo, db: Session) -> bool:
    """
    Restore a photo from trash back to its original album folder.
    """
    try:
        album = db.get(Album, photo.album_id)
        if not album:
            return False

        drive_path = settings.drives.get(photo.drive.value)
        if not drive_path:
            return False

        restore_dir = drive_path / album.name
        restore_dir.mkdir(parents=True, exist_ok=True)

        src  = Path(photo.filepath)
        dest = restore_dir / src.name

        if dest.exists():
            stem, ext = src.stem, src.suffix
            counter = 1
            while dest.exists():
                dest = restore_dir / f"{stem}_{counter}{ext}"
                counter += 1

        shutil.move(str(src), str(dest))

        photo.filepath   = str(dest)
        photo.trashed_at = None
        photo.is_trashed = False
        db.commit()
        return True

    except Exception as e:
        print(f"  ✗ Restore failed: {e}")
        db.rollback()
        return False


def permanently_delete(photo: Photo, db: Session) -> bool:
    """
    Permanently delete a photo from disk and DB.
    This is irreversible.
    """
    try:
        filepath = Path(photo.filepath)
        if filepath.exists():
            filepath.unlink()

        # Remove thumbnail
        from services.thumbnail_service import get_thumbnail_path
        thumb = get_thumbnail_path(photo.id)
        if thumb.exists():
            thumb.unlink()

        db.delete(photo)
        db.commit()
        return True

    except Exception as e:
        print(f"  ✗ Permanent delete failed: {e}")
        db.rollback()
        return False


def auto_delete_expired(db: Session) -> int:
    """
    Auto-delete photos that have been in trash for 30+ days.
    Called on startup and can be triggered manually.
    Returns number of photos deleted.
    """
    cutoff  = datetime.now(timezone.utc) - timedelta(days=30)
    expired = (
        db.query(Photo)
        .filter(Photo.is_trashed == True, Photo.trashed_at <= cutoff)
        .all()
    )

    count = 0
    for photo in expired:
        if permanently_delete(photo, db):
            count += 1

    if count:
        print(f"  ✓ Auto-deleted {count} expired trash items")
    return count


def get_trash_stats(db: Session) -> dict:
    """Return trash statistics."""
    total = db.query(func.count(Photo.id)).filter(Photo.is_trashed == True).scalar()
    size  = db.query(func.sum(Photo.size_kb)).filter(Photo.is_trashed == True).scalar() or 0
    return {
        "total":   total,
        "size_mb": round(size / 1024, 1),
    }
