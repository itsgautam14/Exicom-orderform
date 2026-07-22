"""Passwordless team-member login: request an emailed OTP, verify it, get a
session token. Separate from app.auth.require_admin, which gates the
Catalog/Logistics/Tracking admin areas with a single shared password — this is
a per-person account (email + phone) for the app entrance page.
"""
from __future__ import annotations

import datetime as dt
import secrets

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.email_util import send_otp_email

router = APIRouter(prefix="/api/auth", tags=["auth"])

OTP_TTL_MINUTES = 10
SESSION_TTL_DAYS = 30


def _gen_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


@router.post("/request-otp")
def request_otp(payload: schemas.RequestOtpIn, db: Session = Depends(get_db)):
    """Create the account on first request (unverified until the OTP is entered)."""
    email = payload.email.strip().lower()
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        user = models.User(email=email, phone=payload.phone.strip())
        db.add(user)
    elif payload.phone.strip():
        user.phone = payload.phone.strip()

    otp = _gen_otp()
    user.otp_code = otp
    user.otp_expires_at = _now() + dt.timedelta(minutes=OTP_TTL_MINUTES)
    db.commit()

    send_otp_email(email, otp)
    return {"message": "OTP sent"}


@router.post("/verify-otp", response_model=schemas.AuthOut)
def verify_otp(payload: schemas.VerifyOtpIn, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or not user.otp_code:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Request a code first")
    if user.otp_expires_at is None or user.otp_expires_at < _now():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Code expired — request a new one")
    if payload.otp.strip() != user.otp_code:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Incorrect code")

    user.is_verified = True
    user.otp_code = ""
    user.otp_expires_at = None
    user.session_token = secrets.token_urlsafe(32)
    user.session_expires_at = _now() + dt.timedelta(days=SESSION_TTL_DAYS)
    db.commit()
    db.refresh(user)
    return {"token": user.session_token, "user": user}


def get_current_user(authorization: str = Header(default=""), db: Session = Depends(get_db)) -> models.User:
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    user = db.query(models.User).filter(models.User.session_token == token).first()
    if not user or not user.session_expires_at or user.session_expires_at < _now():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired — log in again")
    return user


@router.get("/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(get_current_user)):
    return user


@router.post("/logout")
def logout(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.session_token = ""
    user.session_expires_at = None
    db.commit()
    return {"message": "Logged out"}
