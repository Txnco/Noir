"""
OAuth2 Authentication Routes
Minimal routes for OAuth2/OIDC authentication.
Most authentication is handled by the external provider.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import settings
from app.core.database import get_db
from app.core.security.oauth2.security import get_current_user
from app.models.user import User
from app.schemas.auth import CurrentUserResponse


router = APIRouter(prefix="/auth", tags=["Authentication (OAuth2)"])


@router.get("/me", response_model=CurrentUserResponse)
async def get_me(
    current_user: User = Depends(get_current_user)
):
    """
    Get current authenticated user information.
    Token validation is handled by the OAuth2 security module.
    """
    # Update last login
    return CurrentUserResponse(
        id=current_user.id,
        firstName=current_user.firstName,
        lastName=current_user.lastName,
        email=current_user.email,
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        roles=[r.name for r in current_user.roles],
        permissions=list(current_user.get_permissions()),
        created_at=current_user.created_at,
        last_login=current_user.last_login
    )


@router.get("/providers")
async def get_auth_providers():
    """
    Get configured OAuth2 provider information.
    Useful for frontend to know which login options are available.
    """
    providers = []
    
    if settings.OAUTH2_ISSUER:
        # Determine provider type from issuer URL
        issuer = settings.OAUTH2_ISSUER.lower()
        
        if "google" in issuer:
            providers.append({
                "name": "Google",
                "type": "google",
                "issuer": settings.OAUTH2_ISSUER
            })
        elif "microsoft" in issuer or "azure" in issuer:
            providers.append({
                "name": "Microsoft",
                "type": "microsoft",
                "issuer": settings.OAUTH2_ISSUER
            })
        elif "github" in issuer:
            providers.append({
                "name": "GitHub",
                "type": "github",
                "issuer": settings.OAUTH2_ISSUER
            })
        elif "auth0" in issuer:
            providers.append({
                "name": "Auth0",
                "type": "auth0",
                "issuer": settings.OAUTH2_ISSUER
            })
        else:
            providers.append({
                "name": "OAuth2 Provider",
                "type": "oauth2",
                "issuer": settings.OAUTH2_ISSUER
            })
    
    return {
        "auth_type": "oauth2",
        "oauth2_enabled": settings.ENABLE_OAUTH2,
        "providers": providers
    }
