"""
services/clip_service.py
CLIP-based photo tagging and embedding generation.
Runs on GPU (CUDA) for fast processing.
Embeddings are stored in DB and reused for duplicate detection.
"""

import json
import torch
import clip
import numpy as np
from PIL import Image
from pathlib import Path
from sqlalchemy.orm import Session

from models import Photo, Tag, TagSource
from config import settings

# ─────────────────────────────────────────────────────────
# Model loading — loaded once, reused for all photos
# ─────────────────────────────────────────────────────────

_model      = None
_preprocess = None
_device     = None


def get_model():
    """Load CLIP model on first call, reuse after."""
    global _model, _preprocess, _device
    if _model is None:
        _device     = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"  → Loading CLIP on {_device.upper()}...")
        _model, _preprocess = clip.load("ViT-B/32", device=_device)
        _model.eval()
        print(f"  ✓ CLIP ready on {_device.upper()}")
    return _model, _preprocess, _device


# ─────────────────────────────────────────────────────────
# Tag categories — what CLIP looks for
# ─────────────────────────────────────────────────────────

TAG_CATEGORIES = {
    "scene": [
        "beach", "mountain", "forest", "park", "city", "street",
        "indoor", "outdoor", "garden", "lake", "river", "ocean",
        "desert", "snow", "countryside", "home", "office", "restaurant",
        "school", "church", "temple", "stadium", "airport", "hospital",
    ],
    "event": [
        "birthday party", "wedding", "graduation", "Christmas",
        "holiday", "vacation", "picnic", "barbecue", "concert",
        "sports event", "family gathering", "anniversary", "festival",
        "new year", "thanksgiving", "baby shower", "funeral",
    ],
    "activity": [
        "eating", "cooking", "swimming", "running", "playing",
        "dancing", "singing", "reading", "sleeping", "working",
        "studying", "shopping", "traveling", "hiking", "cycling",
        "yoga", "exercising", "watching TV", "gaming",
    ],
    "subject": [
        "baby", "child", "teenager", "adult", "elderly person",
        "dog", "cat", "bird", "horse", "family", "couple", "friends",
        "group of people", "selfie", "portrait",
    ],
    "time": [
        "sunrise", "sunset", "daytime", "night", "golden hour",
        "cloudy day", "sunny day", "rainy day", "snowy day",
    ],
    "food": [
        "food", "cake", "pizza", "burger", "salad", "dessert",
        "drinks", "coffee", "breakfast", "lunch", "dinner",
    ],
    "object": [
        "car", "flowers", "trees", "buildings", "art", "music",
        "technology", "books", "toys", "clothing", "jewelry",
    ],
}

# Flatten all tags with their category
ALL_TAGS = []
TAG_TO_CATEGORY = {}
for category, tags in TAG_CATEGORIES.items():
    for tag in tags:
        ALL_TAGS.append(tag)
        TAG_TO_CATEGORY[tag] = category


# ─────────────────────────────────────────────────────────
# Core functions
# ─────────────────────────────────────────────────────────

def generate_embedding(filepath: str) -> list | None:
    """
    Generate a CLIP embedding (512 numbers) for a photo.
    Used for both tagging and duplicate detection.
    """
    try:
        model, preprocess, device = get_model()
        image = preprocess(Image.open(filepath).convert("RGB")).unsqueeze(0).to(device)
        with torch.no_grad():
            embedding = model.encode_image(image)
            embedding = embedding / embedding.norm(dim=-1, keepdim=True)  # normalize
        return embedding.cpu().numpy()[0].tolist()
    except Exception as e:
        print(f"  ✗ Embedding failed for {filepath}: {e}")
        return None


def tag_photo(filepath: str, top_k: int = 8) -> list[dict]:
    """
    Run CLIP zero-shot classification on a photo.
    Returns top_k matching tags with confidence scores.
    """
    try:
        model, preprocess, device = get_model()

        image = preprocess(Image.open(filepath).convert("RGB")).unsqueeze(0).to(device)
        text_tokens = clip.tokenize(
            [f"a photo of {tag}" for tag in ALL_TAGS]
        ).to(device)

        with torch.no_grad():
            image_features = model.encode_image(image)
            text_features  = model.encode_text(text_tokens)

            image_features = image_features / image_features.norm(dim=-1, keepdim=True)
            text_features  = text_features  / text_features.norm(dim=-1, keepdim=True)

            similarity = (100.0 * image_features @ text_features.T).softmax(dim=-1)
            scores     = similarity[0].cpu().numpy()

        # Get top_k results above threshold
        threshold = 0.01
        results = []
        for i, score in enumerate(scores):
            if score >= threshold:
                results.append({
                    "label":      ALL_TAGS[i],
                    "category":   TAG_TO_CATEGORY[ALL_TAGS[i]],
                    "confidence": float(score),
                })

        results.sort(key=lambda x: x["confidence"], reverse=True)
        return results[:top_k]

    except Exception as e:
        print(f"  ✗ Tagging failed for {filepath}: {e}")
        return []


def tag_and_save(photo: Photo, db: Session, force: bool = False) -> bool:
    """
    Tag a photo with CLIP and save tags + embedding to DB.
    Skips if already tagged (unless force=True).
    """
    if photo.ai_tagged and not force:
        return True

    if not Path(photo.filepath).exists():
        return False

    # Generate embedding
    embedding = generate_embedding(photo.filepath)
    if embedding:
        photo.clip_embedding = json.dumps(embedding)

    # Generate tags
    tags = tag_photo(photo.filepath)
    if tags:
        # Remove old AI tags
        db.query(Tag).filter(
            Tag.photo_id == photo.id,
            Tag.source   == TagSource.AI
        ).delete()

        # Save new tags
        for t in tags:
            db.add(Tag(
                photo_id   = photo.id,
                label      = t["label"],
                source     = TagSource.AI,
                confidence = t["confidence"],
            ))

        photo.ai_tagged = True
        db.commit()
        return True

    return False


def tag_all_photos(db: Session, progress_callback=None) -> dict:
    """
    Tag all untagged photos in the library.
    Runs in batches for efficiency.
    Returns summary stats.
    """
    photos = (
        db.query(Photo)
        .filter(Photo.ai_tagged == False, Photo.is_trashed == False)
        .all()
    )

    total   = len(photos)
    done    = 0
    failed  = 0

    print(f"  → Tagging {total} photos with CLIP...")

    for photo in photos:
        ok = tag_and_save(photo, db)
        if ok:
            done += 1
        else:
            failed += 1

        if progress_callback:
            progress_callback(done, total)

        if done % 100 == 0:
            print(f"     {done}/{total} tagged...")

    print(f"  ✓ CLIP tagging complete: {done} tagged, {failed} failed")
    return {"total": total, "tagged": done, "failed": failed}


def get_all_tags(db: Session) -> list[dict]:
    """Return all unique tags with their photo counts."""
    from sqlalchemy import func
    results = (
        db.query(Tag.label, Tag.source, func.count(Tag.id).label("count"))
        .filter(Tag.source.in_([TagSource.AI, TagSource.MANUAL]))
        .group_by(Tag.label, Tag.source)
        .order_by(func.count(Tag.id).desc())
        .all()
    )
    return [{"label": r.label, "source": r.source.value, "count": r.count} for r in results]
