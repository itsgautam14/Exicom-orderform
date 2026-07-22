"""OTP email delivery via plain SMTP.

With SMTP_HOST unset, send_otp_email just logs the code to the server console
instead of failing, so the login flow stays testable before a real mailbox or
transactional-email service is wired in.
"""
from __future__ import annotations

import smtplib
from email.mime.text import MIMEText

from app.config import settings


def send_otp_email(to_email: str, otp: str) -> None:
    subject = "Your Exicom Quote Form verification code"
    body = (
        f"Your one-time verification code is: {otp}\n\n"
        "This code expires in 10 minutes. If you didn't request this, you can ignore this email."
    )

    if not settings.smtp_host:
        print(f"[OTP] SMTP not configured — {to_email}: {otp}")
        return

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to_email

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        server.starttls()
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(settings.smtp_from, [to_email], msg.as_string())
