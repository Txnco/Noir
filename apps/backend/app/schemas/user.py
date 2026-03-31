"""
User Schemas
Pydantic models for user-related requests and responses.
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


# ======================
# Base Schemas
# ======================
class UserBase(BaseModel):
    """Base user schema with common fields."""
    firstName: str = Field(min_length=1, max_length=100)
    lastName: str = Field(min_length=1, max_length=100)
    email: EmailStr


# ======================
# Create/Update Schemas
# ======================
class UserCreate(UserBase):
    """Schema for creating a new user."""
    password: str = Field(min_length=8)


class UserUpdate(BaseModel):
    """Schema for updating a user (all fields optional)."""
    firstName: Optional[str] = Field(None, min_length=1, max_length=100)
    lastName: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None


class UserUpdateProfile(BaseModel):
    """Schema for users updating their own profile."""
    firstName: Optional[str] = Field(None, min_length=1, max_length=100)
    lastName: Optional[str] = Field(None, min_length=1, max_length=100)


# ======================
# Output Schemas
# ======================
class RoleOut(BaseModel):
    """Role output schema."""
    id: int
    name: str
    description: Optional[str] = None
    
    class Config:
        from_attributes = True


class UserOut(UserBase):
    """User output schema (safe for API responses)."""
    id: int
    is_active: bool = True
    is_verified: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserWithRoles(UserOut):
    """User output schema with roles included."""
    roles: List[RoleOut] = []
    
    class Config:
        from_attributes = True


class UserDetail(UserWithRoles):
    """Detailed user output schema (for admin views)."""
    external_provider: Optional[str] = None
    
    class Config:
        from_attributes = True


# ======================
# List/Pagination Schemas
# ======================
class UserList(BaseModel):
    """Paginated list of users."""
    items: List[UserOut]
    total: int
    page: int
    page_size: int
    total_pages: int


# ======================
# Role Assignment Schemas
# ======================
class AssignRoleRequest(BaseModel):
    """Request to assign a role to a user."""
    role_id: int


class AssignRolesRequest(BaseModel):
    """Request to assign multiple roles to a user."""
    role_ids: List[int]


class UserRolesResponse(BaseModel):
    """Response showing user's roles."""
    user_id: int
    roles: List[RoleOut]
    message: str = "Roles updated successfully"