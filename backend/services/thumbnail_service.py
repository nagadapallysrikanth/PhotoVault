"""
services/thumbnail_service.py
Handles thumbnail generation and caching using Pillow.
All image processing logic lives here — nothing else imports Pillow directly.
"""

import os
from pathlib import Path
from PIL import Image, ExifTags
from datetime import datetime
from config import settings

THUMBNAIL_SIZE = (480, 480)


def get_thumbnail_path(photo_id: str) -> Path:
    return settings.thumbnail_dir / f"{photo_id}.jpg"


def thumbnail_exists(photo_id: str) -> bool:
    return get_thumbnail_path(photo_id).exists()


def generate_thumbnail(filepath: str, photo_id: str) -> bool:
    """
    Generate a thumbnail for a photo.
    Returns True on success, False on failure.
    Respects EXIF rotation so photos are never sideways.
    """
    settings.thumbnail_dir.mkdir(parents=True, exist_ok=True)
    thumb_path = get_thumbnail_path(photo_id)

    try:
        with Image.open(filepath) as img:
            # Fix EXIF rotation
            img = _fix_orientation(img)
            img = img.convert("RGB")
            img.thumbnail(THUMBNAIL_SIZE, Image.LANCZOS)
            img.save(thumb_path, "JPEG", quality=82, optimize=True)
        return True
    except Exception as e:
        print(f"  ✗ Thumbnail failed for {filepath}: {e}")
        return False


def get_image_metadata(filepath: str) -> dict:
    """
    Extract width, height, and taken_at from a photo.
    Returns empty dict on failure.
    """
    try:
        with Image.open(filepath) as img:
            width, height = img.size
            taken_at = _get_exif_date(img)
            return {
                "width":    width,
                "height":   height,
                "taken_at": taken_at,
            }
    except Exception:
        return {}


# ─────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────

def _fix_orientation(img: Image.Image) -> Image.Image:
    """Rotate image to match EXIF orientation tag."""
    try:
        exif = img._getexif()
        if not exif:
            return img
        for tag_id, value in exif.items():
            if ExifTags.TAGS.get(tag_id) == "Orientation":
                rotations = {3: 180, 6: 270, 8: 90}
                if value in rotations:
                    img = img.rotate(rotations[value], expand=True)
                break
    except Exception:
        pass
    return img


def _get_exif_date(img: Image.Image) -> datetime | None:
    """Read DateTimeOriginal from EXIF, return as datetime object."""
    try:
        exif = img._getexif()
        if not exif:
            return None
        for tag_id, value in exif.items():
            if ExifTags.TAGS.get(tag_id) == "DateTimeOriginal":
                return datetime.strptime(value, "%Y:%m:%d %H:%M:%S")
    except Exception:
        pass
    return None
