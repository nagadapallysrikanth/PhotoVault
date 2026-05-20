"""
routers/v1/duplicates.py
Duplicate detection endpoints.
Scan library, review groups, keep/delete decisions.
"""

from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db, SessionLocal
from models import Photo, User
from middleware.auth_middleware import require_user, require_admin
from services import duplicate_service, trash_service

router = APIRouter(prefix="/api/v1/duplicates", tags=["duplicates"])

_scan_result  = None
_scan_running = False


@router.post("/scan")
def trigger_scan(
    background_tasks: BackgroundTasks,
    admin:            User    = Depends(require_admin),
    db:               Session = Depends(get_db),
):
    """
    Scan entire library for duplicates (all 3 levels).
    Runs in background — check /duplicates/results when done.
    """
    global _scan_running
    if _scan_running:
        return {"message": "Scan already running"}

    background_tasks.add_task(_run_scan)
    return {"message": "Duplicate scan started"}


@router.get("/status")
def scan_status(_user: User = Depends(require_user)):
    """Check if scan is running and if results are available."""
    return {
        "running":         _scan_running,
        "has_results":     _scan_result is not None,
        "total_groups":    _scan_result["total_groups"] if _scan_result else 0,
    }


@router.get("/results")
def get_results(_user: User = Depends(require_user)):
    """Return duplicate scan results."""
    if not _scan_result:
        raise HTTPException(
            status_code=404,
            detail="No scan results yet. Run POST /duplicates/scan first."
        )
    return _scan_result


@router.post("/resolve")
def resolve_duplicates(
    keep_ids:   List[str],
    delete_ids: List[str],
    db:         Session  = Depends(get_db),
    _user:      User     = Depends(require_user),
):
    """
    Resolve a duplicate group.
    keep_ids   → these photos stay
    delete_ids → these photos go to trash
    Never auto-deletes — always moves to trash first.
    """
    trashed = []
    errors  = []

    for pid in delete_ids:
        if pid in keep_ids:
            continue  # safety check
        photo = db.get(Photo, pid)
        if not photo:
            errors.append({"id": pid, "error": "Not found"})
            continue
        ok = trash_service.move_to_trash(photo, db)
        if ok:
            trashed.append(pid)
        else:
            errors.append({"id": pid, "error": "Failed to trash"})

    return {
        "kept":    len(keep_ids),
        "trashed": len(trashed),
        "errors":  errors,
    }


def _run_scan():
    global _scan_result, _scan_running
    _scan_running = True
    db = SessionLocal()
    try:
        _scan_result = duplicate_service.find_all_duplicates(db)
    finally:
        db.close()
        _scan_running = False
