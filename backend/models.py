"""
models.py — All database tables defined here.
Schema covers all 8 phases so migrations are minimal.
Never alter this file directly after Phase 1 —
always create an Alembic migration instead.
"""

from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, Boolean,
    DateTime, ForeignKey, Text, Enum
)
from sqlalchemy.orm import relationship, DeclarativeBase
import enum


class Base(DeclarativeBase):
    pass


# ─────────────────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    ADMIN  = "admin"   # Full access
    FAMILY = "family"  # View + upload
    GUEST  = "guest"   # Upload via link only (not a real account)


class TagSource(str, enum.Enum):
    MANUAL = "manual"  # User typed it
    AI     = "ai"      # Claude API
    FACE   = "face"    # face_recognition library


class DriveType(str, enum.Enum):
    SSD      = "ssd"
    EXTERNAL = "external"


class SharePermission(str, enum.Enum):
    UPLOAD_ONLY     = "upload_only"      # Friends: upload only, no browsing
    VIEW_AND_UPLOAD = "view_and_upload"  # Friends: view specific album + upload


# ─────────────────────────────────────────────────────────
# Users  (Phase 2)
# ─────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    username      = Column(String(50), unique=True, nullable=False, index=True)
    email         = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role          = Column(Enum(UserRole), default=UserRole.FAMILY, nullable=False)
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime, default=datetime.utcnow)
    last_login    = Column(DateTime, nullable=True)

    # Relationships
    photos      = relationship("Photo", back_populates="uploaded_by_user")
    albums      = relationship("Album", back_populates="created_by_user")
    share_links = relationship("ShareLink", back_populates="created_by_user")

    def __repr__(self):
        return f"<User {self.username} ({self.role})>"


# ─────────────────────────────────────────────────────────
# Failed Login Attempts  (Phase 2 — rate limiting)
# ─────────────────────────────────────────────────────────

class LoginAttempt(Base):
    __tablename__ = "login_attempts"

    id         = Column(Integer, primary_key=True)
    identifier = Column(String(255), index=True)  # IP or username
    attempted_at = Column(DateTime, default=datetime.utcnow)
    success    = Column(Boolean, default=False)


# ─────────────────────────────────────────────────────────
# Invite Links  (Phase 2 — family self-registration)
# ─────────────────────────────────────────────────────────

class InviteLink(Base):
    __tablename__ = "invite_links"

    id            = Column(Integer, primary_key=True)
    token         = Column(String(64), unique=True, nullable=False, index=True)
    label         = Column(String(255), nullable=True)   # e.g. "Mom's invite"
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    used_by_id    = Column(Integer, ForeignKey("users.id"), nullable=True)
    expires_at    = Column(DateTime, nullable=False)
    used_at       = Column(DateTime, nullable=True)
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime, default=datetime.utcnow)

    created_by = relationship("User", foreign_keys=[created_by_id])
    used_by    = relationship("User", foreign_keys=[used_by_id])

    def __repr__(self):
        return f"<InviteLink '{self.label}'>"


# ─────────────────────────────────────────────────────────
# Albums  (Phase 1+)
# ─────────────────────────────────────────────────────────

class Album(Base):
    __tablename__ = "albums"

    id             = Column(Integer, primary_key=True, index=True)
    name           = Column(String(255), nullable=False)
    drive          = Column(Enum(DriveType), nullable=False)
    description    = Column(Text, nullable=True)
    cover_photo_id = Column(Integer, ForeignKey("photos.id"), nullable=True)
    created_by_id  = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow)
    is_private     = Column(Boolean, default=False)

    # Relationships
    photos          = relationship("Photo", back_populates="album",
                                   foreign_keys="Photo.album_id")
    created_by_user = relationship("User", back_populates="albums")
    share_links     = relationship("ShareLink", back_populates="album")

    def __repr__(self):
        return f"<Album '{self.name}' on {self.drive}>"


# ─────────────────────────────────────────────────────────
# Photos  (Phase 1+)
# ─────────────────────────────────────────────────────────

class Photo(Base):
    __tablename__ = "photos"

    id               = Column(String(32), primary_key=True)  # MD5 of path
    filename         = Column(String(512), nullable=False)
    filepath         = Column(String(1024), nullable=False, unique=True)
    drive            = Column(Enum(DriveType), nullable=False)
    album_id         = Column(Integer, ForeignKey("albums.id"), nullable=True)
    uploaded_by_id   = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Image metadata
    size_kb          = Column(Float, nullable=True)
    width            = Column(Integer, nullable=True)
    height           = Column(Integer, nullable=True)
    taken_at         = Column(DateTime, nullable=True)
    year             = Column(String(4), nullable=True, index=True)
    month            = Column(String(2), nullable=True)

    # Processing state
    thumbnail_ready  = Column(Boolean, default=False)
    ai_tagged        = Column(Boolean, default=False)
    face_scanned     = Column(Boolean, default=False)
    is_trashed       = Column(Boolean, default=False, index=True)
    trashed_at       = Column(DateTime, nullable=True)
    caption          = Column(Text, nullable=True)

    created_at       = Column(DateTime, default=datetime.utcnow)

    # Relationships
    album            = relationship("Album", back_populates="photos",
                                    foreign_keys=[album_id])
    uploaded_by_user = relationship("User", back_populates="photos")
    tags             = relationship("Tag", back_populates="photo",
                                    cascade="all, delete-orphan")
    faces            = relationship("Face", back_populates="photo",
                                    cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Photo {self.filename}>"


# ─────────────────────────────────────────────────────────
# Tags  (Phase 8 — AI + manual)
# ─────────────────────────────────────────────────────────

class Tag(Base):
    __tablename__ = "tags"

    id         = Column(Integer, primary_key=True)
    photo_id   = Column(String(32), ForeignKey("photos.id"), nullable=False, index=True)
    label      = Column(String(100), nullable=False, index=True)
    source     = Column(Enum(TagSource), nullable=False)
    confidence = Column(Float, nullable=True)  # AI confidence score 0-1
    created_at = Column(DateTime, default=datetime.utcnow)

    photo = relationship("Photo", back_populates="tags")

    def __repr__(self):
        return f"<Tag '{self.label}' ({self.source})>"


# ─────────────────────────────────────────────────────────
# Faces  (Phase 8 — face recognition)
# ─────────────────────────────────────────────────────────

class Face(Base):
    __tablename__ = "faces"

    id           = Column(Integer, primary_key=True)
    photo_id     = Column(String(32), ForeignKey("photos.id"), nullable=False, index=True)
    person_name  = Column(String(100), nullable=True, index=True)  # null = unknown
    bounding_box = Column(String(100), nullable=True)  # "top,right,bottom,left"
    encoding     = Column(Text, nullable=True)          # face vector for matching
    created_at   = Column(DateTime, default=datetime.utcnow)

    photo = relationship("Photo", back_populates="faces")

    def __repr__(self):
        return f"<Face '{self.person_name or 'Unknown'}' in photo {self.photo_id}>"


# ─────────────────────────────────────────────────────────
# Share Links  (Phase 4 — friend upload links)
# ─────────────────────────────────────────────────────────

class ShareLink(Base):
    __tablename__ = "share_links"

    id             = Column(Integer, primary_key=True)
    token          = Column(String(64), unique=True, nullable=False, index=True)
    album_id       = Column(Integer, ForeignKey("albums.id"), nullable=False)
    created_by_id  = Column(Integer, ForeignKey("users.id"), nullable=False)
    label          = Column(String(255), nullable=True)
    permissions    = Column(Enum(SharePermission),
                            default=SharePermission.UPLOAD_ONLY, nullable=False)
    expires_at     = Column(DateTime, nullable=True)
    max_uploads    = Column(Integer, nullable=True)       # null = unlimited
    upload_count   = Column(Integer, default=0)
    is_active      = Column(Boolean, default=True)
    created_at     = Column(DateTime, default=datetime.utcnow)

    album           = relationship("Album", back_populates="share_links")
    created_by_user = relationship("User", back_populates="share_links")

    def __repr__(self):
        return f"<ShareLink '{self.label}' → album {self.album_id}>"
