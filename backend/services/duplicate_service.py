"""
services/duplicate_service.py
Three-level duplicate detection:
  Level 1 — Exact duplicates (file hash)
  Level 2 — Near duplicates (perceptual hash / imagehash)
  Level 3 — Similar photos (CLIP embeddings — same moment, burst photos)
"""

import json
import hashlib
import numpy as np
from pathlib import Path
from sqlalchemy.orm import Session
from PIL import Image
import imagehash

from models import Photo


# ─────────────────────────────────────────────────────────
# Level 1 — Exact duplicates (MD5 hash)
# ─────────────────────────────────────────────────────────

def file_hash(filepath: str) -> str | None:
    """Compute MD5 hash of file contents."""
    try:
        h = hashlib.md5()
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                h.update(chunk)
        return h.hexdigest()
    except Exception:
        return None


def find_exact_duplicates(db: Session) -> list[dict]:
    """Find photos with identical file contents."""
    photos  = db.query(Photo).filter(Photo.is_trashed == False).all()
    hashes  = {}
    groups  = []

    for photo in photos:
        if not Path(photo.filepath).exists():
            continue
        h = file_hash(photo.filepath)
        if not h:
            continue
        if h in hashes:
            hashes[h].append(photo)
        else:
            hashes[h] = [photo]

    for h, dupes in hashes.items():
        if len(dupes) > 1:
            groups.append({
                "type":       "exact",
                "similarity": 100,
                "label":      "Exact duplicate",
                "photos":     [_photo_dict(p) for p in dupes],
            })

    return groups


# ─────────────────────────────────────────────────────────
# Level 2 — Near duplicates (perceptual hash)
# ─────────────────────────────────────────────────────────

def perceptual_hash(filepath: str) -> str | None:
    """Compute perceptual hash — similar images get similar hashes."""
    try:
        img = Image.open(filepath).convert("RGB")
        return str(imagehash.phash(img))
    except Exception:
        return None


def find_near_duplicates(db: Session, threshold: int = 8) -> list[dict]:
    """
    Find near-duplicate photos using perceptual hashing.
    threshold: max hamming distance (lower = more similar, 0 = identical visually)
    """
    photos = db.query(Photo).filter(Photo.is_trashed == False).all()
    hashes = []

    for photo in photos:
        if not Path(photo.filepath).exists():
            continue
        h = perceptual_hash(photo.filepath)
        if h:
            hashes.append((photo, imagehash.hex_to_hash(h)))

    groups  = []
    matched = set()

    for i, (photo_a, hash_a) in enumerate(hashes):
        if photo_a.id in matched:
            continue
        group = [photo_a]

        for j, (photo_b, hash_b) in enumerate(hashes):
            if i == j or photo_b.id in matched:
                continue
            distance = hash_a - hash_b
            if 0 < distance <= threshold:
                group.append(photo_b)
                matched.add(photo_b.id)

        if len(group) > 1:
            matched.add(photo_a.id)
            similarity = max(0, round(100 - (min(threshold, 8) / 8 * 30)))
            groups.append({
                "type":       "near",
                "similarity": similarity,
                "label":      "Near duplicate (compressed/resized version)",
                "photos":     [_photo_dict(p) for p in group],
            })

    return groups


# ─────────────────────────────────────────────────────────
# Level 3 — Similar photos (CLIP embeddings)
# ─────────────────────────────────────────────────────────

def cosine_similarity(a: list, b: list) -> float:
    """Compute cosine similarity between two embedding vectors."""
    a = np.array(a)
    b = np.array(b)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def find_similar_photos(db: Session, threshold: float = 0.92) -> list[dict]:
    """
    Find visually similar photos using CLIP embeddings.
    threshold: 0.92 = burst photos, 0.98 = near-identical
    Only works for photos that have been CLIP-tagged.
    """
    photos = (
        db.query(Photo)
        .filter(
            Photo.is_trashed     == False,
            Photo.clip_embedding.isnot(None),
        )
        .all()
    )

    if len(photos) < 2:
        return []

    # Load all embeddings
    embeddings = []
    for photo in photos:
        try:
            emb = json.loads(photo.clip_embedding)
            embeddings.append((photo, emb))
        except Exception:
            continue

    groups  = []
    matched = set()

    for i, (photo_a, emb_a) in enumerate(embeddings):
        if photo_a.id in matched:
            continue

        group = [photo_a]

        for j, (photo_b, emb_b) in enumerate(embeddings):
            if i == j or photo_b.id in matched:
                continue
            sim = cosine_similarity(emb_a, emb_b)
            if sim >= threshold:
                group.append(photo_b)
                matched.add(photo_b.id)

        if len(group) > 1:
            matched.add(photo_a.id)
            avg_sim = round(threshold * 100)
            groups.append({
                "type":       "similar",
                "similarity": avg_sim,
                "label":      "Similar photos (burst / same moment)",
                "photos":     [_photo_dict(p) for p in group],
            })

    return groups


# ─────────────────────────────────────────────────────────
# Full scan
# ─────────────────────────────────────────────────────────

def find_all_duplicates(db: Session) -> dict:
    """
    Run all three levels of duplicate detection.
    Returns combined results grouped by type.
    """
    print("  → Scanning for exact duplicates...")
    exact  = find_exact_duplicates(db)

    print("  → Scanning for near duplicates...")
    near   = find_near_duplicates(db)

    print("  → Scanning for similar photos (CLIP)...")
    similar = find_similar_photos(db)

    all_groups = exact + near + similar
    print(f"  ✓ Found {len(all_groups)} duplicate groups")

    return {
        "total_groups": len(all_groups),
        "exact":        len(exact),
        "near":         len(near),
        "similar":      len(similar),
        "groups":       all_groups,
    }


# ─────────────────────────────────────────────────────────
# Helper
# ─────────────────────────────────────────────────────────

def _photo_dict(p: Photo) -> dict:
    return {
        "id":            p.id,
        "filename":      p.filename,
        "filepath":      p.filepath,
        "drive":         p.drive.value if p.drive else None,
        "album_id":      p.album_id,
        "size_kb":       p.size_kb,
        "taken_at":      p.taken_at.isoformat() if p.taken_at else None,
        "thumbnail_url": f"/api/v1/photos/{p.id}/thumbnail",
    }
