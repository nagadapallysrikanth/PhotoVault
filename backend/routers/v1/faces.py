"""
routers/v1/faces.py
Face recognition endpoints.
Train people, scan library, name unknown faces.
"""

import os
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List

from database import get_db, SessionLocal
from models import Photo, Face, User
from middleware.auth_middleware import require_user, require_admin
from services import face_service
from config import settings

router = APIRouter(prefix="/api/v1/faces", tags=["faces"])

_scan_progress = {"total": 0, "done": 0, "running": False}


# ─────────────────────────────────────────────────────────
# People management
# ─────────────────────────────────────────────────────────

@router.get("/people")
def list_people(
    db:    Session = Depends(get_db),
    _user: User    = Depends(require_user),
):
    """List all trained people."""
    return face_service.get_all_people(db)


@router.post("/people/train")
async def train_person(
    name:  str               = Form(...),
    files: List[UploadFile]  = File(...),
    db:    Session           = Depends(get_db),
    admin: User              = Depends(require_admin),
):
    """
    Train the system to recognise a person.
    Upload 5-10 clear photos of the person.
    """
    if not name.strip():
        raise HTTPException(status_code=400, detail="Name is required")

    # Save uploaded training photos temporarily
    temp_dir = Path(settings.thumbnail_dir.parent) / "face_training"
    temp_dir.mkdir(parents=True, exist_ok=True)

    saved_paths = []
    for file in files:
        if not file.filename:
            continue
        content  = await file.read()
        tmp_path = temp_dir / f"{name}_{file.filename}"
        tmp_path.write_bytes(content)
        saved_paths.append(str(tmp_path))

    if not saved_paths:
        raise HTTPException(status_code=400, detail="No valid files uploaded")

    result = face_service.train_person(name.strip(), saved_paths, db)

    # Clean up temp files
    for p in saved_paths:
        try:
            Path(p).unlink()
        except Exception:
            pass

    return result


@router.delete("/people/{name}")
def delete_person(
    name:  str,
    db:    Session = Depends(get_db),
    admin: User    = Depends(require_admin),
):
    """Remove all training data for a person."""
    deleted = face_service.delete_person(name, db)
    return {"message": f"Removed {deleted} face encodings for '{name}'"}


# ─────────────────────────────────────────────────────────
# Library scanning
# ─────────────────────────────────────────────────────────

@router.post("/scan")
def trigger_face_scan(
    background_tasks: BackgroundTasks,
    admin:            User    = Depends(require_admin),
    db:               Session = Depends(get_db),
):
    """
    Scan all unscanned photos for faces.
    Runs in background — check /faces/scan/progress.
    """
    if _scan_progress["running"]:
        return {"message": "Scan already running", "progress": _scan_progress}

    unscanned = db.query(Photo).filter(
        Photo.face_scanned == False,
        Photo.is_trashed   == False,
    ).count()

    background_tasks.add_task(_run_face_scan)

    return {
        "message":  f"Face scan started for {unscanned} photos",
        "progress": _scan_progress,
    }


@router.get("/scan/progress")
def scan_progress(_user: User = Depends(require_user)):
    """Get face scan progress."""
    return _scan_progress


# ─────────────────────────────────────────────────────────
# Unknown faces
# ─────────────────────────────────────────────────────────

@router.get("/unknown")
def get_unknown_faces(
    limit: int     = 50,
    db:    Session = Depends(get_db),
    admin: User    = Depends(require_admin),
):
    """Return unidentified faces for naming."""
    return face_service.get_unknown_faces(db, limit=limit)


@router.post("/unknown/{face_id}/name")
def name_face(
    face_id: int,
    name:    str,
    db:      Session = Depends(get_db),
    admin:   User    = Depends(require_admin),
):
    """Name an unknown face."""
    if not name.strip():
        raise HTTPException(status_code=400, detail="Name is required")

    ok = face_service.name_unknown_face(face_id, name.strip(), db)
    if not ok:
        raise HTTPException(status_code=404, detail="Face not found")

    return {"message": f"Face identified as '{name}'"}


# ─────────────────────────────────────────────────────────
# Background task
# ─────────────────────────────────────────────────────────

def _run_face_scan():
    global _scan_progress
    _scan_progress["running"] = True
    _scan_progress["done"]    = 0

    db = SessionLocal()
    try:
        def update_progress(done, total):
            _scan_progress["done"]  = done
            _scan_progress["total"] = total

        face_service.scan_all_faces(db, progress_callback=update_progress)
    finally:
        db.close()
        _scan_progress["running"] = False
