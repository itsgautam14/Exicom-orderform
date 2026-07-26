"""Generic SMTP mailer — works with any mailbox that exposes standard SMTP
(Gmail, Outlook/365, or a company mailbox). No paid email API, no billing.

Uses only the Python standard library (`smtplib` + `email.mime`).
"""
from __future__ import annotations

import smtplib
from email.mime.text import MIMEText

from fastapi import HTTPException, status

from app.config import settings


class EmailSendError(Exception):
    pass


def send_email(to_email: str, subject: str, body: str) -> None:
    if not settings.smtp_host or not settings.smtp_user or not settings.smtp_password:
        raise EmailSendError(
            "SMTP is not configured — set SMTP_HOST, SMTP_USER and SMTP_PASSWORD in the backend .env"
        )
    if not to_email:
        raise EmailSendError("This user has no email address on file — ask an admin to set one")

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = settings.from_email or settings.smtp_user
    msg["To"] = to_email

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            if settings.smtp_use_tls:
                server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(msg["From"], [to_email], msg.as_string())
    except (smtplib.SMTPException, OSError, TimeoutError) as exc:
        raise EmailSendError(f"Could not send email via SMTP: {exc}") from exc


def send_otp_email(to_email: str, otp: str, expires_minutes: int) -> None:
    subject = "Your Exicom Order Form login code"
    body = (
        f"Your one-time login code is: {otp}\n\n"
        f"This code expires in {expires_minutes} minutes. "
        "If you did not request this, you can ignore this email."
    )
    try:
        send_email(to_email, subject, body)
    except EmailSendError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc))
