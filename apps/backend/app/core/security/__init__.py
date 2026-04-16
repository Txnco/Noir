"""
Authentication via Supabase Auth.

Supabase owns identity (auth.users) and issues JWTs. This module validates
those JWTs and exposes the caller as a lightweight `CurrentUser` — the
profile row is loaded lazily by endpoints that need it.
"""
from app.core.security.supabase import (
    CurrentUser,
    decode_supabase_token,
    get_current_user,
    get_current_profile,
)

__all__ = [
    "CurrentUser",
    "decode_supabase_token",
    "get_current_user",
    "get_current_profile",
]
