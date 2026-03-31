"""
Authentication Schemas
Pydantic models for authentication requests and responses.
"""
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List
from datetime import datetime
import re

from app.core.config import settings


# ======================
# Token Schemas
# ======================
class Token(BaseModel):
    """JWT token response."""
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: int = Field(description="Token expiration time in seconds")


class TokenPayload(BaseModel):
    """JWT token payload."""
    sub: str  # Subject (user ID)
    exp: int  # Expiration timestamp
    iat: int  # Issued at timestamp
    jti: str  # JWT ID (unique identifier)
    roles: List[str] = []
    perms: List[str] = []


class RefreshTokenRequest(BaseModel):
    """Request to refresh access token."""
    refresh_token: str


# ======================
# Login Schemas
# ======================
class LoginRequest(BaseModel):
    """User login request."""
    email: EmailStr
    password: str = Field(min_length=1)


class LoginResponse(BaseModel):
    """User login response."""
    user: "UserOut"
    tokens: Token
    message: str = "Login successful"


# ======================
# Registration Schemas
# ======================
class RegisterRequest(BaseModel):
    """User registration request."""
    firstName: str = Field(min_length=1, max_length=100)
    lastName: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8)
    password_confirm: str = Field(min_length=8)
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password against policy."""
        errors = []
        
        if len(v) < settings.PASSWORD_MIN_LENGTH:
            errors.append(f"Password must be at least {settings.PASSWORD_MIN_LENGTH} characters")
        
        if settings.PASSWORD_REQUIRE_UPPERCASE and not re.search(r'[A-Z]', v):
            errors.append("Password must contain at least one uppercase letter")
        
        if settings.PASSWORD_REQUIRE_LOWERCASE and not re.search(r'[a-z]', v):
            errors.append("Password must contain at least one lowercase letter")
        
        if settings.PASSWORD_REQUIRE_DIGIT and not re.search(r'\d', v):
            errors.append("Password must contain at least one digit")
        
        if settings.PASSWORD_REQUIRE_SPECIAL and not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            errors.append("Password must contain at least one special character")
        
        if errors:
            raise ValueError("; ".join(errors))
        
        return v
    
    @field_validator('password_confirm')
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        """Ensure password and confirmation match."""
        if 'password' in info.data and v != info.data['password']:
            raise ValueError("Passwords do not match")
        return v


class RegisterResponse(BaseModel):
    """User registration response."""
    user: "UserOut"
    tokens: Optional[Token] = None  # Optional: auto-login after registration
    message: str = "Registration successful"


# ======================
# Password Reset Schemas
# ======================
class ForgotPasswordRequest(BaseModel):
    """Request password reset email."""
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    """Forgot password response."""
    message: str = "If the email exists, a password reset link has been sent"


class ResetPasswordRequest(BaseModel):
    """Reset password with token."""
    token: str
    password: str = Field(min_length=8)
    password_confirm: str = Field(min_length=8)
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password against policy."""
        errors = []
        
        if len(v) < settings.PASSWORD_MIN_LENGTH:
            errors.append(f"Password must be at least {settings.PASSWORD_MIN_LENGTH} characters")
        
        if settings.PASSWORD_REQUIRE_UPPERCASE and not re.search(r'[A-Z]', v):
            errors.append("Password must contain at least one uppercase letter")
        
        if settings.PASSWORD_REQUIRE_LOWERCASE and not re.search(r'[a-z]', v):
            errors.append("Password must contain at least one lowercase letter")
        
        if settings.PASSWORD_REQUIRE_DIGIT and not re.search(r'\d', v):
            errors.append("Password must contain at least one digit")
        
        if settings.PASSWORD_REQUIRE_SPECIAL and not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            errors.append("Password must contain at least one special character")
        
        if errors:
            raise ValueError("; ".join(errors))
        
        return v
    
    @field_validator('password_confirm')
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        """Ensure password and confirmation match."""
        if 'password' in info.data and v != info.data['password']:
            raise ValueError("Passwords do not match")
        return v


class ResetPasswordResponse(BaseModel):
    """Reset password response."""
    message: str = "Password has been reset successfully"


# ======================
# Change Password Schemas
# ======================
class ChangePasswordRequest(BaseModel):
    """Change password (authenticated user)."""
    current_password: str
    new_password: str = Field(min_length=8)
    new_password_confirm: str = Field(min_length=8)
    
    @field_validator('new_password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password against policy."""
        errors = []
        
        if len(v) < settings.PASSWORD_MIN_LENGTH:
            errors.append(f"Password must be at least {settings.PASSWORD_MIN_LENGTH} characters")
        
        if settings.PASSWORD_REQUIRE_UPPERCASE and not re.search(r'[A-Z]', v):
            errors.append("Password must contain at least one uppercase letter")
        
        if settings.PASSWORD_REQUIRE_LOWERCASE and not re.search(r'[a-z]', v):
            errors.append("Password must contain at least one lowercase letter")
        
        if settings.PASSWORD_REQUIRE_DIGIT and not re.search(r'\d', v):
            errors.append("Password must contain at least one digit")
        
        if settings.PASSWORD_REQUIRE_SPECIAL and not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            errors.append("Password must contain at least one special character")
        
        if errors:
            raise ValueError("; ".join(errors))
        
        return v
    
    @field_validator('new_password_confirm')
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        """Ensure password and confirmation match."""
        if 'new_password' in info.data and v != info.data['new_password']:
            raise ValueError("Passwords do not match")
        return v


class ChangePasswordResponse(BaseModel):
    """Change password response."""
    message: str = "Password changed successfully"


# ======================
# Verify Email Schemas
# ======================
class VerifyEmailRequest(BaseModel):
    """Verify email with token."""
    token: str


class VerifyEmailResponse(BaseModel):
    """Verify email response."""
    message: str = "Email verified successfully"


class ResendVerificationRequest(BaseModel):
    """Request to resend verification email."""
    email: EmailStr


class ResendVerificationResponse(BaseModel):
    """Resend verification response."""
    message: str = "If the email exists and is unverified, a verification link has been sent"


# ======================
# Current User Schemas
# ======================
class CurrentUserResponse(BaseModel):
    """Current user information response."""
    id: int
    firstName: str
    lastName: str
    email: str
    is_active: bool
    is_verified: bool
    roles: List[str]
    permissions: List[str]
    created_at: datetime
    last_login: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# Import UserOut for forward reference resolution
from app.schemas.user import UserOut

# Update forward references
LoginResponse.model_rebuild()
RegisterResponse.model_rebuild()
