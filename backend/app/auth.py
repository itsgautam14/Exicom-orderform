"""Shared admin authentication for write-protected endpoints.

Reads are public; writes require the admin password via the `X-Admin-Password`
header, checked against `settings.admin_password` (server-side only).
"""
from fastapi import Header, HTTPException, status

from app.config import settings


def require_admin(x_admin_password: str = Header(default="")) -> None:
    if x_admin_password != settings.admin_password:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid admin password")
