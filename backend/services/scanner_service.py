"""
services/scanner_service.py
Scans configured drives for photos and syncs them to the database.
This is what keeps the DB in sync with files on disk.
"""

import os
import hashlib
from pathlib import Path
from datetime import datetime
from sqlalchemy.orm import Session

from config import settings
from models import Photo, Album, DriveType
from services.thumbnail_service import (
    generate_thumbnail,
    get_image_metadata,
    thumbnail_exists,
)


def photo_id(filepath: str) -> str:
    """Stable unique ID — MD5 of the absolute file path."""
    return hashlib.md5(os.path.abspath(filepath).encode()).hexdigest()


def is_image(filename: str) -> bool:
    return Path(filename).suffix.lower() in settings.ALLOWED_EXTENSIONS


# ─────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────

def scan_all_drives(db: Session) -> dict:
    """
    Scan every configured drive and sync photos to DB.
    Safe to call multiple times — skips photos already in DB.
    Returns a summary of what was found.
    """
    summary = {"drives": [], "total_new": 0, "total_known": 0, "errors": 0}

    for drive_name, drive_path in settings.drives.items():
        result = scan_drive(db, drive_name, drive_path)
        summary["drives"].append(result)
        summary["total_new"]   += result["new"]
        summary["total_known"] += result["known"]
        summary["errors"]      += result["errors"]

    return summary


def scan_drive(db: Session, drive_name: str, drive_path: Path) -> dict:
    """Scan a single drive and sync new photos to DB."""
    result = {
        "drive":  drive_name,
        "path":   str(drive_path),
        "new":    0,
        "known":  0,
        "errors": 0,
        "available": False,
    }

    if not drive_path.is_dir():
        print(f"  ✗ Drive not available: [{drive_name}] {drive_path}")
        return result

    result["available"] = True
    drive_type = DriveType(drive_name)
    print(f"  → Scanning [{drive_name}] {drive_path} ...")

    for root, dirs, files in os.walk(drive_path):
        # Skip hidden folders (e.g. .Trash)
        dirs[:] = [d for d in dirs if not d.startswith(".")]

        for filename in files:
            if not is_image(filename):
                continue

            full_path = os.path.join(root, filename)
            pid = photo_id(full_path)

            # Already in DB — skip
            if db.get(Photo, pid):
                result["known"] += 1
                continue

            try:
                stat = os.stat(full_path)
                meta = get_image_metadata(full_path)
                taken_at = meta.get("taken_at") or datetime.fromtimestamp(stat.st_mtime)
                folder_name = Path(root).name

                # Get or create album for this folder
                album = _get_or_create_album(db, folder_name, drive_type)

                photo = Photo(
                    id             = pid,
                    filename       = filename,
                    filepath       = full_path,
                    drive          = drive_type,
                    album_id       = album.id,
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

                # Generate thumbnail (skip if already cached from a previous scan)
                if not thumbnail_exists(pid):
                    ok = generate_thumbnail(full_path, pid)
                    if ok:
                        photo.thumbnail_ready = True
                        db.commit()
                else:
                    photo.thumbnail_ready = True
                    db.commit()

                result["new"] += 1

            except Exception as e:
                print(f"  ✗ Error processing {full_path}: {e}")
                result["errors"] += 1
                db.rollback()

    print(f"     [{drive_name}] +{result['new']} new, {result['known']} known, {result['errors']} errors")
    return result


def get_stats(db: Session) -> dict:
    """Return library-wide statistics."""
    from sqlalchemy import func

    total = db.query(func.count(Photo.id)).scalar()
    total_size = db.query(func.sum(Photo.size_kb)).scalar() or 0

    years = (
        db.query(Photo.year)
        .filter(Photo.year.isnot(None))
        .distinct()
        .order_by(Photo.year.desc())
        .all()
    )

    drive_stats = []
    for drive_name, drive_path in settings.drives.items():
        drive_type = DriveType(drive_name)
        count = db.query(func.count(Photo.id)).filter(Photo.drive == drive_type).scalar()
        size  = db.query(func.sum(Photo.size_kb)).filter(Photo.drive == drive_type).scalar() or 0
        drive_stats.append({
            "drive":      drive_name,
            "path":       str(drive_path),
            "available":  drive_path.is_dir(),
            "photos":     count,
            "size_mb":    round(size / 1024, 1),
        })

    return {
        "total_photos": total,
        "total_size_gb": round(total_size / (1024 * 1024), 2),
        "years":  [y[0] for y in years],
        "drives": drive_stats,
    }


# ─────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────

def _get_or_create_album(db: Session, name: str, drive: DriveType) -> Album:
    """Find an existing album by name+drive or create it."""
    album = (
        db.query(Album)
        .filter(Album.name == name, Album.drive == drive)
        .first()
    )
    if not album:
        album = Album(name=name, drive=drive)
        db.add(album)
        db.commit()
        db.refresh(album)
    return album
