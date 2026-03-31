"""
JWT Authentication Routes
Handles login, register, password reset, and token refresh endpoints.
"""
import hashlib
import secrets
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from time import time as time_now
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_db
from app.core.logger import get_logger, log_security_event
from app.core.security.jwt.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    oauth2_scheme,
)
from app.models import User, Role, Permission
from app.models.role import Role
from app.schemas.auth import (
    Token,
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
    ChangePasswordRequest,
    ChangePasswordResponse,
    RefreshTokenRequest,
    CurrentUserResponse,
    VerifyEmailRequest,
    VerifyEmailResponse,
)
from app.schemas.user import UserOut

# Email service
from app.core.email import (
    send_password_reset_email as email_password_reset,
    send_verification_email as email_verification,
    send_welcome_email as email_welcome,
)

logger = get_logger("jetapi.auth")
router = APIRouter(prefix="/auth", tags=["Authentication"])


# =============================================================================
# Security Helpers
# =============================================================================
def hash_token(token: str) -> str:
    """Hash a token for secure storage."""
    return hashlib.sha256(token.encode()).hexdigest()


def generate_secure_token(length: int = 32) -> str:
    """Generate a cryptographically secure random token."""
    return secrets.token_urlsafe(length)


DUMMY_HASH = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4kVDUMMYTIMINGATTACK"


# =============================================================================
# Rate Limiting for Auth Endpoints
# =============================================================================
from app.core.redis import get_redis

def _get_client_ip(request: Request) -> str:
    """Extract client IP address."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


async def check_auth_rate_limit(identifier: str, ip: str):
    """Check if login attempts are rate limited."""
    redis = get_redis()
    if not redis:
        return
        
    key = f"auth_rate_limit:{identifier}:{ip}"
    window = settings.AUTH_RATE_LIMIT_WINDOW
    max_attempts = settings.AUTH_RATE_LIMIT_ATTEMPTS

    attempts = await redis.incr(key)
    if attempts == 1:
        await redis.expire(key, window)

    if attempts > max_attempts:
        log_security_event(
            "AUTH_RATE_LIMIT",
            f"Rate limit exceeded for {identifier}",
            ip_address=ip,
        )
        ttl = await redis.ttl(key)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many login attempts. Please try again in {ttl} seconds.",
            headers={"Retry-After": str(ttl)},
        )


async def clear_auth_rate_limit(identifier: str, ip: str):
    """Clear rate limit on successful login."""
    redis = get_redis()
    if redis:
        await redis.delete(f"auth_rate_limit:{identifier}:{ip}")


# =============================================================================
# Token Helpers
# =============================================================================
def create_user_tokens(user: User) -> Token:
    """Create access and refresh tokens for a user."""
    roles = [r.name for r in user.roles]
    permissions = list(user.get_permissions())

    access_token = create_access_token(
        sub=str(user.id),
        roles=roles,
        permissions=permissions
    )
    refresh_token = create_refresh_token(sub=str(user.id))

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


# =============================================================================
# Login Endpoints
# =============================================================================
@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    req: Request,
    db: AsyncSession = Depends(get_db)
):
    """Authenticate user and return JWT tokens."""
    client_ip = _get_client_ip(req)
    await check_auth_rate_limit(request.email, client_ip)

    stmt = select(User).where(User.email == request.email)
    result = await db.execute(stmt)
    user = result.scalars().first()

    # TIMING ATTACK PREVENTION
    password_hash = user.hashed_password if user and user.hashed_password else DUMMY_HASH
    password_valid = verify_password(request.password, password_hash)

    if not user or not password_valid:
        log_security_event(
            "LOGIN_FAILED",
            f"Invalid credentials for {request.email}",
            ip_address=client_ip,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.is_locked():
        lock_remaining = int((user.locked_until - datetime.now(timezone.utc)).total_seconds())
        log_security_event(
            "LOGIN_LOCKED",
            f"Login attempt on locked account {request.email}",
            ip_address=client_ip,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is temporarily locked. Try again in {lock_remaining} seconds.",
            headers={"Retry-After": str(lock_remaining)},
        )

    if not user.is_active:
        log_security_event(
            "LOGIN_DISABLED",
            f"Login attempt on disabled account {request.email}",
            ip_address=client_ip,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )

    if settings.REQUIRE_EMAIL_VERIFICATION and not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address before logging in"
        )

    await clear_auth_rate_limit(request.email, client_ip)

    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login = datetime.now(timezone.utc)

    tokens = create_user_tokens(user)
    user.refresh_token_hash = hash_token(tokens.refresh_token)
    await db.flush()
    await db.commit()

    log_security_event(
        "LOGIN_SUCCESS",
        f"User {request.email} logged in",
        user_id=str(user.id),
        ip_address=client_ip,
    )

    return LoginResponse(
        user=UserOut.model_validate(user),
        tokens=tokens,
        message="Login successful"
    )


@router.post("/login/form", response_model=Token)
async def login_form(
    req: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """OAuth2 compatible login endpoint (for Swagger UI)."""
    client_ip = _get_client_ip(req)
    await check_auth_rate_limit(form_data.username, client_ip)

    stmt = select(User).where(User.email == form_data.username)
    result = await db.execute(stmt)
    user = result.scalars().first()

    password_hash = user.hashed_password if user and user.hashed_password else DUMMY_HASH
    password_valid = verify_password(form_data.password, password_hash)

    if not user or not password_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.is_locked():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is temporarily locked"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )

    if settings.REQUIRE_EMAIL_VERIFICATION and not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address"
        )

    await clear_auth_rate_limit(form_data.username, client_ip)

    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login = datetime.now(timezone.utc)

    tokens = create_user_tokens(user)
    user.refresh_token_hash = hash_token(tokens.refresh_token)
    await db.flush()
    await db.commit()

    return tokens


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    token: str = Depends(oauth2_scheme),
    current_user: User = Depends(get_current_user)
):
    """Logout user and invalidate token."""
    try:
        payload = decode_token(token)
        jti = payload.get("jti")
        exp = payload.get("exp")
        
        if jti and exp:
            from app.core.redis import get_redis
            redis = get_redis()
            if redis is not None:
                now = int(time_now())
                ttl = max(0, exp - now)
                if ttl > 0:
                    await redis.setex(f"bl:{jti}", ttl, "1")
    except Exception as e:
        logger.error(f"Logout failed: {e}")
        
    return {"message": "Successfully logged out"}


# =============================================================================
# Registration Endpoints
# =============================================================================
@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: RegisterRequest,
    req: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user account."""
    client_ip = _get_client_ip(req)

    stmt = select(User).where(User.email == request.email)
    result = await db.execute(stmt)
    existing_user = result.scalars().first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    role_stmt = select(Role).where(Role.name == "user")
    role_result = await db.execute(role_stmt)
    default_role = role_result.scalars().first()

    verification_token = generate_secure_token()

    new_user = User(
        firstName=request.firstName,
        lastName=request.lastName,
        email=request.email,
        hashed_password=hash_password(request.password),
        is_active=True,
        is_verified=False,
        email_verification_token_hash=hash_token(verification_token),
        roles=[default_role] if default_role else []
    )

    db.add(new_user)
    await db.flush()
    await db.refresh(new_user)

    background_tasks.add_task(
        email_verification,
        new_user.email,
        verification_token,
        f"{new_user.firstName} {new_user.lastName}",
    )

    tokens = create_user_tokens(new_user)
    new_user.refresh_token_hash = hash_token(tokens.refresh_token)
    await db.flush()
    await db.commit()

    log_security_event(
        "USER_REGISTERED",
        f"New user registered: {request.email}",
        user_id=str(new_user.id),
        ip_address=client_ip,
    )

    return RegisterResponse(
        user=UserOut.model_validate(new_user),
        tokens=tokens,
        message="Registration successful. Please verify your email."
    )


# =============================================================================
# Token Refresh Endpoints
# =============================================================================
@router.post("/refresh", response_model=Token)
async def refresh_token(
    request: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db)
):
    """Refresh access token using refresh token."""
    try:
        payload = decode_token(request.refresh_token)

        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type"
            )

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )

        stmt = select(User).where(User.id == int(user_id))
        result = await db.execute(stmt)
        user = result.scalars().first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is disabled"
            )

        if user.refresh_token_hash != hash_token(request.refresh_token):
            log_security_event(
                "INVALID_REFRESH_TOKEN",
                f"Invalid refresh token for user {user.id}",
                user_id=str(user.id),
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )

        tokens = create_user_tokens(user)
        user.refresh_token_hash = hash_token(tokens.refresh_token)
        await db.flush()

        return tokens

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )


# =============================================================================
# Password Reset Endpoints
# =============================================================================
@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(
    request: ForgotPasswordRequest,
    req: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Request password reset email. Always returns success to prevent email enumeration."""
    client_ip = _get_client_ip(req)

    stmt = select(User).where(User.email == request.email)
    result = await db.execute(stmt)
    user = result.scalars().first()

    if user and user.is_active:
        reset_token = generate_secure_token()
        user.password_reset_token_hash = hash_token(reset_token)
        user.password_reset_expires = datetime.now(timezone.utc) + timedelta(hours=1)
        await db.flush()

        background_tasks.add_task(
            email_password_reset,
            user.email,
            reset_token,
            f"{user.firstName} {user.lastName}",
        )

        log_security_event(
            "PASSWORD_RESET_REQUESTED",
            f"Password reset requested for {request.email}",
            user_id=str(user.id) if user else None,
            ip_address=client_ip,
        )

    return ForgotPasswordResponse()


@router.post("/reset-password", response_model=ResetPasswordResponse)
async def reset_password(
    request: ResetPasswordRequest,
    req: Request,
    db: AsyncSession = Depends(get_db)
):
    """Reset password using reset token."""
    client_ip = _get_client_ip(req)

    token_hash = hash_token(request.token)
    stmt = select(User).where(User.password_reset_token_hash == token_hash)
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user:
        log_security_event(
            "INVALID_RESET_TOKEN",
            "Invalid password reset token used",
            ip_address=client_ip,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )

    if user.password_reset_expires and user.password_reset_expires < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired"
        )

    user.hashed_password = hash_password(request.password)
    user.password_reset_token_hash = None
    user.password_reset_expires = None
    user.refresh_token_hash = None
    user.failed_login_attempts = 0
    user.locked_until = None
    await db.flush()

    log_security_event(
        "PASSWORD_RESET_SUCCESS",
        f"Password reset for {user.email}",
        user_id=str(user.id),
        ip_address=client_ip,
    )

    return ResetPasswordResponse()


# =============================================================================
# Change Password Endpoints
# =============================================================================
@router.post("/change-password", response_model=ChangePasswordResponse)
async def change_password(
    request: ChangePasswordRequest,
    req: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Change password for authenticated user."""
    client_ip = _get_client_ip(req)

    if not current_user.hashed_password or not verify_password(
        request.current_password, current_user.hashed_password
    ):
        log_security_event(
            "PASSWORD_CHANGE_FAILED",
            f"Invalid current password for {current_user.email}",
            user_id=str(current_user.id),
            ip_address=client_ip,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    current_user.hashed_password = hash_password(request.new_password)
    current_user.refresh_token_hash = None
    await db.flush()

    log_security_event(
        "PASSWORD_CHANGED",
        f"Password changed for {current_user.email}",
        user_id=str(current_user.id),
        ip_address=client_ip,
    )

    return ChangePasswordResponse()


# =============================================================================
# Email Verification Endpoints
# =============================================================================
@router.post("/verify-email", response_model=VerifyEmailResponse)
async def verify_email(
    request: VerifyEmailRequest,
    db: AsyncSession = Depends(get_db)
):
    """Verify email address using verification token."""
    token_hash = hash_token(request.token)
    stmt = select(User).where(User.email_verification_token_hash == token_hash)
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification token"
        )

    user.is_verified = True
    user.email_verification_token_hash = None
    await db.flush()

    log_security_event(
        "EMAIL_VERIFIED",
        f"Email verified for {user.email}",
        user_id=str(user.id),
    )

    return VerifyEmailResponse()


@router.post("/resend-verification")
async def resend_verification(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Resend email verification for current user."""
    if current_user.is_verified:
        return {"message": "Email already verified"}

    verification_token = generate_secure_token()
    current_user.email_verification_token_hash = hash_token(verification_token)
    await db.flush()

    background_tasks.add_task(
        email_verification,
        current_user.email,
        verification_token,
        f"{current_user.firstName} {current_user.lastName}",
    )

    return {"message": "Verification email sent"}


# =============================================================================
# Current User Endpoints
# =============================================================================
@router.get("/me", response_model=CurrentUserResponse)
async def get_me(
    current_user: User = Depends(get_current_user)
):
    """Get current authenticated user information."""
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


@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Logout user by invalidating refresh token."""
    current_user.refresh_token_hash = None
    await db.flush()
    return {"message": "Logged out successfully"}
