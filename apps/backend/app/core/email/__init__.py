"""
JetApi Email Service
Supports both SMTP and Amazon SES (API).
"""
from app.core.email.service import (
    EmailService,
    email_service,
    send_email,
    send_password_reset_email,
    send_verification_email,
    send_welcome_email,
)

__all__ = [
    "EmailService",
    "email_service",
    "send_email",
    "send_password_reset_email",
    "send_verification_email",
    "send_welcome_email",
]
