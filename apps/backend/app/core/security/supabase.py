"""
Supabase Authentication Security Module
Validates JWT tokens issued by Supabase Auth.
"""
from typing import Optional, List, Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from pydantic import BaseModel, Field
from app.core.config import settings

# OAuth2 scheme for token extraction from Authorization header
reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl="not-used-with-supabase",
    auto_error=True
)

class SupabaseUser(BaseModel):
    """
    Represents a user authenticated via Supabase.
    The 'id' matches the 'sub' UUID from Supabase.
    """
    id: str = Field(..., alias="sub")
    email: Optional[str] = None
    role: str = "authenticated"
    app_metadata: Dict[str, Any] = {}
    user_metadata: Dict[str, Any] = {}
    aud: str = "authenticated"

def decode_supabase_token(token: str) -> Dict[str, Any]:
    """
    Decodes and validates a Supabase JWT token using the Supabase JWT Secret.
    """
    try:
        # Supabase uses the HS256 algorithm by default
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY if not hasattr(settings, 'SUPABASE_JWT_SECRET') else settings.SUPABASE_JWT_SECRET, 
            algorithms=["HS256"],
            options={"verify_aud": False} # Supabase uses 'authenticated' as audience
        )
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_user(token: str = Depends(reusable_oauth2)) -> SupabaseUser:
    """
    FastAPI dependency to get the current user from the Supabase JWT.
    """
    payload = decode_supabase_token(token)
    return SupabaseUser(**payload)

async def get_current_active_user(user: SupabaseUser = Depends(get_current_user)) -> SupabaseUser:
    """
    FastAPI dependency to ensure the user is active (Supabase handles this mostly, 
    but we can add extra checks here if needed).
    """
    return user
