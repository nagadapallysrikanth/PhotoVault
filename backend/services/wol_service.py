"""
services/wol_service.py
Wake-on-LAN — sends a magic packet to wake your PC remotely.
Requires WOL enabled in BIOS and PC_MAC_ADDRESS set in .env
"""

import socket
import struct
from config import settings


def send_magic_packet(mac_address: str) -> bool:
    """
    Send a Wake-on-LAN magic packet to the given MAC address.
    Works on local network and via router port forwarding.
    Returns True on success, False on failure.
    """
    try:
        # Clean MAC address — remove colons, dashes, spaces
        mac_clean = mac_address.replace(":", "").replace("-", "").replace(" ", "")

        if len(mac_clean) != 12:
            print(f"  ✗ Invalid MAC address: {mac_address}")
            return False

        # Build magic packet: 6x FF + 16x MAC address
        mac_bytes  = bytes.fromhex(mac_clean)
        magic      = b'\xff' * 6 + mac_bytes * 16

        # Send via UDP broadcast on port 9
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            sock.sendto(magic, ('<broadcast>', 9))
            # Also send to specific IP if configured
            if settings.PC_LOCAL_IP:
                sock.sendto(magic, (settings.PC_LOCAL_IP, 9))

        print(f"  ✓ Magic packet sent to {mac_address}")
        return True

    except Exception as e:
        print(f"  ✗ WOL failed: {e}")
        return False


def wake_pc() -> bool:
    """Wake the configured PC using MAC from .env"""
    if not settings.PC_MAC_ADDRESS:
        print("  ✗ PC_MAC_ADDRESS not set in .env")
        return False
    return send_magic_packet(settings.PC_MAC_ADDRESS)


def is_pc_online() -> bool:
    """
    Check if the PC is reachable on the local network.
    Tries to connect to the FastAPI port — if it responds, PC is on.
    """
    if not settings.PC_LOCAL_IP:
        return False
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2)
        result = sock.connect_ex((settings.PC_LOCAL_IP, settings.APP_PORT))
        sock.close()
        return result == 0
    except Exception:
        return False
