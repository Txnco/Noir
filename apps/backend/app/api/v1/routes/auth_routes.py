"""
Auth Routes for Noir API.

These routes handle session information and profile retrieval for the
authenticated user. Actual login/signup is handled via Supabase direct.
"""
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    CurrentUser, 
    get_current_user, 
    get_current_profile
)
from app.services.rbac import get_platform_role, get_org_roles
from app.schemas.auth import (
    CurrentUserResponse, 
    OrgMembershipOut, 
    ProfileOut,
    LoginRequest,
    SignupRequest,
    AuthTokenResponse
)
from app.models.profile import Profile

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/login", response_model=AuthTokenResponse)
async def login(payload: LoginRequest):
    """
    Log in using email and password via Supabase.
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase is not properly configured"
        )
        
    url = f"{settings.SUPABASE_URL}/auth/v1/token?grant_type=password"
    headers = {
        "apikey": settings.SUPABASE_ANON_KEY,
        "Content-Type": "application/json"
    }
    data = {
        "email": payload.email,
        "password": payload.password
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=data, headers=headers)
        
    if response.status_code != 200:
        error_detail = response.json().get("error_description") or response.json().get("msg") or "Login failed"
        raise HTTPException(
            status_code=response.status_code,
            detail=error_detail
        )
        
    return response.json()

@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(payload: SignupRequest):
    """
    Sign up a new user via Supabase.
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase is not properly configured"
        )
        
    url = f"{settings.SUPABASE_URL}/auth/v1/signup"
    headers = {
        "apikey": settings.SUPABASE_ANON_KEY,
        "Content-Type": "application/json"
    }
    data = {
        "email": payload.email,
        "password": payload.password,
        "data": {
            "firstName": payload.firstName,
            "lastName": payload.lastName
        }
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=data, headers=headers)
        
    if response.status_code not in (200, 201):
        error_detail = response.json().get("msg") or "Signup failed"
        raise HTTPException(
            status_code=response.status_code,
            detail=error_detail
        )
        
    return {"message": "Signup successful. Please check your email for verification."}

@router.get("/me", response_model=CurrentUserResponse)
async def get_me(
    user: CurrentUser = Depends(get_current_user),
    profile: Profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns the current authenticated user's identity, profile, and roles.
    This is the main entry point for the frontend to know "who is logged in".
    """
    platform_role = await get_platform_role(db, user.id)
    org_memberships = await get_org_roles(db, user.id)
    
    # Format org memberships for the response
    memberships = [
        OrgMembershipOut(org_id=org_id, role=role, is_active=True) 
        for org_id, role in org_memberships.items()
    ]
    
    return CurrentUserResponse(
        id=user.id,
        email=user.email,
        email_verified=user.email_verified,
        profile=ProfileOut.model_validate(profile),
        platform_role=platform_role,
        memberships=memberships
    )
