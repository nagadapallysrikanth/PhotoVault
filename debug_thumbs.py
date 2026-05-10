import sys
sys.path.insert(0, 'backend')

from backend.database import SessionLocal, init_db
from backend.models import Photo
from backend.auth import create_access_token
from backend.services import thumbnail_service
import traceback

# Init
init_db()
db = SessionLocal()

# Get first photo
photo = db.query(Photo).first()
print(f"Photo ID: {photo.id}")
print(f"Photo Filepath: {photo.filepath}")

# Create a token
token = create_access_token(1, "admin")
print(f"Token: {token[:20]}...")

# Try to get thumbnail
try:
    from pathlib import Path
    thumb_path = thumbnail_service.get_thumbnail_path(photo.id)
    print(f"Thumb path: {thumb_path}")
    print(f"Thumb exists: {thumb_path.exists()}")
    
    # Try to read file
    with open(thumb_path, 'rb') as f:
        data = f.read()
        print(f"Thumb size: {len(data)} bytes")
except Exception as e:
    print(f"Error: {e}")
    traceback.print_exc()

db.close()
