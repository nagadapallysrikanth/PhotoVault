"""
config.py — Single source of truth for all app settings.
All values come from .env — never hardcoded.
To change any setting: edit .env only, restart the app.
"""

from pydantic_settings import BaseSettings
from pydantic import field_validator
from pathlib import Path
from typing import Optional


class Settings(BaseSettings):
    # ── Storage ───────────────────────────────────────────
    SSD_PATH: str = "~/Pictures/PhotoVault"
    EXTERNAL_PATH: str = "D:/PhotoVault"
    THUMBNAIL_DIR: str = "~/.photovault/thumbnails"

    # ── App ───────────────────────────────────────────────
    APP_NAME: str = "PhotoVault"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 5000
    DEBUG: bool = False

    MAX_UPLOAD_MB: int = 200

    # Allowed image extensions
    ALLOWED_EXTENSIONS: tuple = (
        ".jpg", ".jpeg", ".png", ".gif",
        ".webp", ".heic", ".bmp", ".tiff"
    )

    # ── Security ──────────────────────────────────────────
    SECRET_KEY: str = "change-me"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    MAX_LOGIN_ATTEMPTS: int = 5
    LOCKOUT_MINUTES: int = 15

    # ── Email ─────────────────────────────────────────────
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    NOTIFY_EMAIL: Optional[str] = None

    # ── Push Notifications ────────────────────────────────
    NTFY_TOPIC: Optional[str] = None
    NTFY_SERVER: str = "https://ntfy.sh"

    # ── Wake-on-LAN ───────────────────────────────────────
    PC_MAC_ADDRESS: Optional[str] = None
    PC_LOCAL_IP: Optional[str] = None

    # ── AI ────────────────────────────────────────────────
    ANTHROPIC_API_KEY: Optional[str] = None

    # ── Cloudflare ────────────────────────────────────────
    PUBLIC_URL: Optional[str] = None

    # ── Derived properties ────────────────────────────────
    @property
    def ssd_path(self) -> Path:
        return Path(self.SSD_PATH).expanduser()

    @property
    def external_path(self) -> Path:
        return Path(self.EXTERNAL_PATH).expanduser()

    @property
    def thumbnail_dir(self) -> Path:
        return Path(self.THUMBNAIL_DIR).expanduser()

    @property
    def drives(self) -> dict:
        """
        All configured storage drives.
        Add new drives here in the future — nothing else needs to change.
        """
        return {
            "ssd":      self.ssd_path,
            "external": self.external_path,
        }

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_MB * 1024 * 1024

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


# Single instance used everywhere
# Import like: from config import settings
settings = Settings()
