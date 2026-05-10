"""
routers/v1/wol.py
Wake-on-LAN endpoints.
Only accessible to authenticated users.
"""

import asyncio
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User
from middleware.auth_middleware import require_user, require_admin
from services import wol_service
from config import settings

router = APIRouter(prefix="/api/v1/wol", tags=["wake-on-lan"])


@router.get("/status")
def pc_status(_user: User = Depends(require_user)):
    """
    Check if the home PC is currently online.
    Returns online/offline + whether WOL is configured.
    """
    configured = bool(settings.PC_MAC_ADDRESS and settings.PC_LOCAL_IP)
    online     = wol_service.is_pc_online() if configured else False

    return {
        "online":     online,
        "configured": configured,
        "pc_ip":      settings.PC_LOCAL_IP or "not set",
        "message":    "PC is online" if online else "PC appears to be sleeping",
    }


@router.post("/wake")
async def wake_pc(_user: User = Depends(require_user)):
    """
    Send a Wake-on-LAN magic packet to wake the home PC.
    Available to all authenticated users — family can wake the PC too.
    """
    if not settings.PC_MAC_ADDRESS:
        raise HTTPException(
            status_code=400,
            detail="Wake-on-LAN is not configured. Set PC_MAC_ADDRESS in .env"
        )

    success = wol_service.wake_pc()

    if not success:
        raise HTTPException(status_code=500, detail="Failed to send magic packet")

    # Wait a moment then check if it's coming online
    await asyncio.sleep(2)
    online = wol_service.is_pc_online()

    return {
        "sent":    True,
        "online":  online,
        "message": "Magic packet sent! PC should wake up within 30 seconds." if not online
                   else "PC is already online.",
    }


@router.get("/config")
def wol_config(admin: User = Depends(require_admin)):
    """Return WOL configuration status (admin only)."""
    return {
        "mac_address": settings.PC_MAC_ADDRESS or "not set",
        "pc_ip":       settings.PC_LOCAL_IP    or "not set",
        "configured":  bool(settings.PC_MAC_ADDRESS and settings.PC_LOCAL_IP),
    }
