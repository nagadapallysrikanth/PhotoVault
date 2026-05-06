"""
schemas.py — All request/response data shapes.
Pydantic validates incoming data automatically — bad data never reaches the DB.
Add new schemas here as phases grow. Never modify existing ones — extend them.
"""

from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime
from models import UserRole


# ─────────────────────────────────────────────────────────
# Auth
# ─────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"
    expires_in:    int  # seconds


class RefreshRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password:     str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")
        return v


# ─────────────────────────────────────────────────────────
# Users
# ─────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    id:         int
    username:   str
    email:      str
    role:       UserRole
    is_active:  bool
    created_at: datetime
    last_login: Optional[datetime]

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    """Used by admin to create a family member directly."""
    username: str
    email:    EmailStr
    password: str
    role:     UserRole = UserRole.FAMILY

    @field_validator("username")
    @classmethod
    def username_valid(cls, v):
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters")
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Username can only contain letters, numbers, - and _")
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")
        return v


# ─────────────────────────────────────────────────────────
# Invite Links (family self-registration)
# ─────────────────────────────────────────────────────────

class InviteLinkCreate(BaseModel):
    """Admin creates an invite link for a family member."""
    label:      Optional[str] = None   # e.g. "Mom's invite"
    expires_hours: int = 48            # link valid for 48 hours by default


class InviteLinkResponse(BaseModel):
    token:      str
    label:      Optional[str]
    expires_at: datetime
    url:        str                    # full link to send


class RegisterViaInvite(BaseModel):
    """Family member fills this form when clicking an invite link."""
    token:    str
    username: str
    email:    EmailStr
    password: str

    @field_validator("username")
    @classmethod
    def username_valid(cls, v):
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters")
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Username can only contain letters, numbers, - and _")
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")
        return v


# ─────────────────────────────────────────────────────────
# Share Links (friends — no account needed)
# ─────────────────────────────────────────────────────────

class ShareLinkCreate(BaseModel):
    album_id:      int
    label:         str                  # e.g. "BBQ July 2025"
    permissions:   str = "upload_only"  # "upload_only" | "view_and_upload"
    expires_days:  int = 7
    max_uploads:   Optional[int] = None # None = unlimited

    @field_validator("permissions")
    @classmethod
    def valid_permissions(cls, v):
        if v not in ("upload_only", "view_and_upload"):
            raise ValueError("permissions must be 'upload_only' or 'view_and_upload'")
        return v


class ShareLinkResponse(BaseModel):
    token:        str
    label:        str
    permissions:  str
    expires_at:   Optional[datetime]
    max_uploads:  Optional[int]
    upload_count: int
    is_active:    bool
    url:          str

    class Config:
        from_attributes = True
