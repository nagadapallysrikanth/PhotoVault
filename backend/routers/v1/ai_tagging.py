"""
routers/v1/ai_tagging.py
AI tagging endpoints — trigger CLIP tagging, browse tags, search by tag.
"""

from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db, SessionLocal
from models import Photo, Tag, TagSource, User
from middleware.auth_middleware import require_user, require_admin
from services import clip_service

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])

# Track progress globally (simple approach)
_progress = {"total": 0, "done": 0, "running": False}


# ─────────────────────────────────────────────────────────
# Tagging
# ─────────────────────────────────────────────────────────

@router.post("/tag")
def trigger_tagging(
    background_tasks: BackgroundTasks,
    force:            bool    = False,
    admin:            User    = Depends(require_admin),
    db:               Session = Depends(get_db),
):
    """
    Trigger CLIP tagging for all untagged photos.
    Runs in background — check /ai/progress for status.
    force=True retags already-tagged photos.
    """
    if _progress["running"]:
        return {"message": "Tagging already running", "progress": _progress}

    untagged = db.query(Photo).filter(
        Photo.is_trashed == False,
        Photo.ai_tagged  == (False if not force else True) or True,
    ).count()

    background_tasks.add_task(_run_tagging, force)
    return {
        "message": f"Tagging started for {untagged} photos",
        "progress": _progress,
    }


@router.post("/tag/{photo_id}")
def tag_single_photo(
    photo_id: str,
    db:       Session = Depends(get_db),
    _user:    User    = Depends(require_user),
):
    """Tag a single photo immediately (not background)."""
    photo = db.get(Photo, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    ok = clip_service.tag_and_save(photo, db, force=True)
    if not ok:
        raise HTTPException(status_code=500, detail="Tagging failed")

    tags = db.query(Tag).filter(Tag.photo_id == photo_id).all()
    return {
        "photo_id": photo_id,
        "tags": [{"label": t.label, "confidence": t.confidence} for t in tags],
    }


@router.get("/progress")
def get_progress(_user: User = Depends(require_user)):
    """Get tagging progress."""
    return _progress


# ─────────────────────────────────────────────────────────
# Tags browser
# ─────────────────────────────────────────────────────────

@router.get("/tags")
def list_tags(
    db:    Session = Depends(get_db),
    _user: User    = Depends(require_user),
):
    """Return all tags with photo counts — for tag cloud."""
    return clip_service.get_all_tags(db)


@router.get("/tags/search")
def search_by_tag(
    q:      str,
    limit:  int     = 100,
    db:     Session = Depends(get_db),
    _user:  User    = Depends(require_user),
):
    """Search photos by tag label."""
    tags = (
        db.query(Tag)
        .filter(Tag.label.ilike(f"%{q}%"))
        .all()
    )
    photo_ids = list({t.photo_id for t in tags})

    photos = (
        db.query(Photo)
        .filter(Photo.id.in_(photo_ids), Photo.is_trashed == False)
        .limit(limit)
        .all()
    )

    return {
        "query":  q,
        "total":  len(photos),
        "photos": [_photo_dict(p) for p in photos],
    }


@router.post("/tags/manual")
def add_manual_tag(
    photo_id: str,
    label:    str,
    db:       Session = Depends(get_db),
    _user:    User    = Depends(require_user),
):
    """Add a manual tag to a photo."""
    photo = db.get(Photo, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    existing = db.query(Tag).filter(
        Tag.photo_id == photo_id,
        Tag.label    == label.strip().lower(),
    ).first()

    if existing:
        return {"message": "Tag already exists"}

    db.add(Tag(
        photo_id = photo_id,
        label    = label.strip().lower(),
        source   = TagSource.MANUAL,
    ))
    db.commit()
    return {"message": "Tag added", "label": label}


@router.delete("/tags/{tag_id}")
def delete_tag(
    tag_id: int,
    db:     Session = Depends(get_db),
    _user:  User    = Depends(require_user),
):
    """Delete a tag."""
    tag = db.get(Tag, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    db.delete(tag)
    db.commit()
    return {"message": "Tag deleted"}


# ─────────────────────────────────────────────────────────
# Background task
# ─────────────────────────────────────────────────────────

def _run_tagging(force: bool):
    global _progress
    _progress["running"] = True
    _progress["done"]    = 0

    db = SessionLocal()
    try:
        def update_progress(done, total):
            _progress["done"]  = done
            _progress["total"] = total

        clip_service.tag_all_photos(db, progress_callback=update_progress)
    finally:
        db.close()
        _progress["running"] = False


def _photo_dict(p: Photo) -> dict:
    return {
        "id":            p.id,
        "filename":      p.filename,
        "taken_at":      p.taken_at.isoformat() if p.taken_at else None,
        "thumbnail_url": f"/api/v1/photos/{p.id}/thumbnail",
        "original_url":  f"/api/v1/photos/{p.id}/original",
    }
