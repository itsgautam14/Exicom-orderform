"""Login endpoints: username/password -> emailed OTP -> JWT.

No token is issued until the OTP is verified. The OTP itself is never logged
or returned in any response — it only ever goes out over SMTP.
"""
from __future__ import annotations

import datetime as dt
import random

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import create_access_token, get_current_user, hash_password, verify_password
from app.config import settings
from app.database import get_db
from app.email_util import send_otp_email

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _generate_otp() -> str:
    return f"{random.randint(0, 999999):06d}"


@router.post("/signup")
def signup(payload: schemas.SignupIn, db: Session = Depends(get_db)):
    """Self-service registration. The account is created but inactive — an
    admin must assign a role and activate it (Users tab) before it can log in."""
    if not payload.username.strip() or not payload.email.strip() or not payload.password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Username, email and password are required")
    if db.query(models.User).filter(models.User.username == payload.username).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "That username is already taken")

    user = models.User(
        username=payload.username,
        email=payload.email,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        is_active=False,
    )
    db.add(user)
    db.commit()
    return {"message": "Account created. An admin needs to approve it before you can log in."}


@router.post("/login")
def login(payload: schemas.LoginIn, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == payload.username).first()
    # Same error for "no such user" and "wrong password" — don't reveal which.
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "This account has been deactivated")

    window_start = dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=settings.otp_request_window_minutes)
    recent_count = (
        db.query(func.count(models.OTPCode.id))
        .filter(models.OTPCode.user_id == user.id, models.OTPCode.created_at >= window_start)
        .scalar()
    )
    if recent_count >= settings.otp_max_requests_per_window:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Too many login codes requested — please wait a few minutes and try again.",
        )

    otp = _generate_otp()
    code = models.OTPCode(
        user_id=user.id,
        code=otp,
        expires_at=dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=settings.otp_expires_minutes),
    )
    db.add(code)
    db.commit()

    send_otp_email(user.email, otp, settings.otp_expires_minutes)
    return {"message": f"A login code has been sent to {user.email}"}


@router.post("/verify-otp", response_model=schemas.TokenOut)
def verify_otp(payload: schemas.VerifyOtpIn, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == payload.username).first()
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or code")

    now = dt.datetime.now(dt.timezone.utc)
    code = (
        db.query(models.OTPCode)
        .filter(
            models.OTPCode.user_id == user.id,
            models.OTPCode.code == payload.otp,
            models.OTPCode.used == False,  # noqa: E712
        )
        .order_by(models.OTPCode.created_at.desc())
        .first()
    )
    if not code or code.expires_at.replace(tzinfo=dt.timezone.utc) < now:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired code")

    code.used = True
    db.commit()

    token = create_access_token(user)
    return schemas.TokenOut(access_token=token, user=schemas.UserOut.model_validate(user))


@router.get("/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(get_current_user)):
    return user
