"""
services/face_service.py
Face detection and recognition using face_recognition library.
Runs 100% locally — no internet, no cost, no privacy concerns.
"""

import json
import numpy as np
import face_recognition
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import func

from models import Photo, Face, Tag, TagSource
from config import settings


# ─────────────────────────────────────────────────────────
# People management
# ─────────────────────────────────────────────────────────

def get_all_people(db: Session) -> list[dict]:
    """Return all trained people with their face counts."""
    results = (
        db.query(Face.person_name, func.count(Face.id).label("count"))
        .filter(Face.person_name.isnot(None))
        .group_by(Face.person_name)
        .order_by(Face.person_name)
        .all()
    )
    return [{"name": r.person_name, "face_count": r.count} for r in results]


def train_person(name: str, photo_paths: list[str], db: Session) -> dict:
    """
    Train the system to recognise a person from sample photos.
    Extracts face encodings and stores them with the person's name.
    Returns how many faces were successfully learned.
    """
    learned = 0
    failed  = 0

    for path in photo_paths:
        try:
            image     = face_recognition.load_image_file(path)
            encodings = face_recognition.face_encodings(image)

            if not encodings:
                failed += 1
                continue

            # Use the first (largest) face found
            encoding = encodings[0]

            # Find the photo in DB (if it was uploaded through the app)
            photo = db.query(Photo).filter(Photo.filepath == path).first()

            face = Face(
                photo_id    = photo.id if photo else None,
                person_name = name,
                encoding    = json.dumps(encoding.tolist()),
            )
            db.add(face)
            learned += 1

        except Exception as e:
            print(f"  ✗ Training failed for {path}: {e}")
            failed += 1

    db.commit()
    return {"name": name, "learned": learned, "failed": failed}


def delete_person(name: str, db: Session) -> int:
    """Remove all face encodings for a person."""
    deleted = (
        db.query(Face)
        .filter(Face.person_name == name)
        .delete()
    )
    db.commit()
    return deleted


# ─────────────────────────────────────────────────────────
# Face scanning
# ─────────────────────────────────────────────────────────

def _get_known_encodings(db: Session) -> tuple[list, list]:
    """Load all known face encodings from DB."""
    faces = (
        db.query(Face)
        .filter(Face.person_name.isnot(None), Face.encoding.isnot(None))
        .all()
    )
    encodings = []
    names     = []
    for face in faces:
        try:
            enc = np.array(json.loads(face.encoding))
            encodings.append(enc)
            names.append(face.person_name)
        except Exception:
            continue
    return encodings, names


def scan_photo_for_faces(photo: Photo, db: Session, tolerance: float = 0.6) -> list[str]:
    """
    Detect and identify faces in a single photo.
    Returns list of identified person names.
    """
    if not Path(photo.filepath).exists():
        return []

    try:
        image     = face_recognition.load_image_file(photo.filepath)
        locations = face_recognition.face_locations(image, model="hog")

        if not locations:
            photo.face_scanned = True
            db.commit()
            return []

        encodings_found = face_recognition.face_encodings(image, locations)
        known_encodings, known_names = _get_known_encodings(db)

        # Remove old face tags for this photo
        db.query(Face).filter(
            Face.photo_id == photo.id,
            Face.person_name.isnot(None)
        ).delete()

        identified = []

        for i, (encoding, location) in enumerate(zip(encodings_found, locations)):
            top, right, bottom, left = location
            bbox = f"{top},{right},{bottom},{left}"
            person_name = None

            if known_encodings:
                matches    = face_recognition.compare_faces(known_encodings, encoding, tolerance=tolerance)
                distances  = face_recognition.face_distance(known_encodings, encoding)

                if True in matches:
                    best_idx    = int(np.argmin(distances))
                    person_name = known_names[best_idx]
                    identified.append(person_name)

            face = Face(
                photo_id    = photo.id,
                person_name = person_name,
                bounding_box= bbox,
                encoding    = json.dumps(encoding.tolist()) if person_name is None else None,
            )
            db.add(face)

            # Also add as a tag if identified
            if person_name:
                existing_tag = db.query(Tag).filter(
                    Tag.photo_id == photo.id,
                    Tag.label    == person_name,
                    Tag.source   == TagSource.FACE,
                ).first()
                if not existing_tag:
                    db.add(Tag(
                        photo_id   = photo.id,
                        label      = person_name,
                        source     = TagSource.FACE,
                        confidence = 1.0,
                    ))

        photo.face_scanned = True
        db.commit()
        return identified

    except Exception as e:
        print(f"  ✗ Face scan failed for {photo.filepath}: {e}")
        db.rollback()
        return []


def scan_all_faces(db: Session, progress_callback=None) -> dict:
    """
    Scan all unscanned photos for faces.
    This is CPU-intensive — runs in background.
    """
    photos = (
        db.query(Photo)
        .filter(Photo.face_scanned == False, Photo.is_trashed == False)
        .all()
    )

    total      = len(photos)
    done       = 0
    identified = 0

    print(f"  → Scanning {total} photos for faces...")

    for photo in photos:
        names = scan_photo_for_faces(photo, db)
        identified += len(names)
        done += 1

        if progress_callback:
            progress_callback(done, total)

        if done % 50 == 0:
            print(f"     {done}/{total} scanned, {identified} faces identified...")

    print(f"  ✓ Face scan complete: {done} photos, {identified} faces identified")
    return {"total": total, "scanned": done, "identified": identified}


def get_unknown_faces(db: Session, limit: int = 50) -> list[dict]:
    """Return faces that haven't been identified yet."""
    faces = (
        db.query(Face)
        .filter(Face.person_name.is_(None), Face.bounding_box.isnot(None))
        .limit(limit)
        .all()
    )
    return [
        {
            "id":           f.id,
            "photo_id":     f.photo_id,
            "bounding_box": f.bounding_box,
            "thumbnail_url":f"/api/v1/photos/{f.photo_id}/thumbnail" if f.photo_id else None,
        }
        for f in faces
    ]


def name_unknown_face(face_id: int, name: str, db: Session) -> bool:
    """
    Assign a name to an unknown face.
    Also saves the encoding as a training sample for future scans.
    """
    face = db.get(Face, face_id)
    if not face:
        return False

    face.person_name = name
    db.commit()

    # Add as tag on the photo
    if face.photo_id:
        existing = db.query(Tag).filter(
            Tag.photo_id == face.photo_id,
            Tag.label    == name,
            Tag.source   == TagSource.FACE,
        ).first()
        if not existing:
            db.add(Tag(
                photo_id   = face.photo_id,
                label      = name,
                source     = TagSource.FACE,
                confidence = 1.0,
            ))
        db.commit()

    return True
