"""
services/notification_service.py
Sends email and push notifications.
Email uses Gmail SMTP. Push uses ntfy.sh (free, no account needed).
To switch providers: only edit this file.
"""

import smtplib
import httpx
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import settings


# ─────────────────────────────────────────────────────────
# Push notification (ntfy.sh)
# ─────────────────────────────────────────────────────────

def send_push(title: str, message: str, tags: str = "camera"):
    """
    Send a push notification via ntfy.sh.
    Free, no account needed. Install the ntfy app on your phone
    and subscribe to your NTFY_TOPIC.
    """
    if not settings.NTFY_TOPIC:
        return  # not configured — skip silently

    try:
        httpx.post(
            f"{settings.NTFY_SERVER}/{settings.NTFY_TOPIC}",
            content=message,
            headers={
                "Title": title,
                "Tags":  tags,
                "Priority": "default",
            },
            timeout=10,
        )
    except Exception as e:
        print(f"  ✗ Push notification failed: {e}")


# ─────────────────────────────────────────────────────────
# Email notification (Gmail SMTP)
# ─────────────────────────────────────────────────────────

def send_email(subject: str, body: str):
    """
    Send an email via Gmail SMTP.
    Requires SMTP_USER, SMTP_PASSWORD (Gmail App Password), NOTIFY_EMAIL in .env
    """
    if not all([settings.SMTP_USER, settings.SMTP_PASSWORD, settings.NOTIFY_EMAIL]):
        return  # not configured — skip silently

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"[PhotoVault] {subject}"
        msg["From"]    = settings.SMTP_USER
        msg["To"]      = settings.NOTIFY_EMAIL

        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, settings.NOTIFY_EMAIL, msg.as_string())

    except Exception as e:
        print(f"  ✗ Email notification failed: {e}")


# ─────────────────────────────────────────────────────────
# Combined notification helpers
# ─────────────────────────────────────────────────────────

def notify_friend_upload(album_name: str, file_count: int, share_label: str):
    """Called when a friend uploads via a share link."""
    title   = f"{file_count} new photo{'s' if file_count != 1 else ''} uploaded"
    message = f"Via share link '{share_label}' → album '{album_name}'"

    send_push(title, message, tags="camera,inbox_tray")
    send_email(title, f"{message}\n\nOpen PhotoVault to view them.")


def notify_family_upload(username: str, album_name: str, file_count: int):
    """Called when a family member uploads."""
    title   = f"{username} added {file_count} photo{'s' if file_count != 1 else ''}"
    message = f"Added to album '{album_name}'"

    send_push(title, message, tags="camera")
