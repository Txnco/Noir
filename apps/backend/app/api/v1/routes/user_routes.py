"""
User Routes
CRUD operations for user management with RBAC protection.
"""
from typing import Optional
from math import ceil

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user, get_current_active_user, hash_password
from app.models.user import User
from app.models.role import Role
from app.services.rbac import require_roles, require_permissions
from app.schemas.user import (
    UserCreate,
    UserUpdate,
    UserUpdateProfile,
    UserOut,
    UserWithRoles,
    UserDetail,
    UserList,
    AssignRolesRequest,
    UserRolesResponse,
)


router = APIRouter(prefix="/users", tags=["Users"])


# ======================
# User CRUD Operations
# ======================
@router.get("", response_model=UserList)
async def list_users(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by name or email"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("users:read"))
):
    """List all users with pagination and search. Requires 'users:read' permission."""
    query = select(User)
    count_query = select(func.count(User.id))

    # Apply filters
    if search:
        search_term = f"%{search}%"
        search_filter = or_(
            User.firstName.ilike(search_term),
            User.lastName.ilike(search_term),
            User.email.ilike(search_term)
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    if is_active is not None:
        query = query.where(User.is_active == is_active)
        count_query = count_query.where(User.is_active == is_active)

    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    users = result.scalars().all()

    return UserList(
        items=[UserOut.model_validate(u) for u in users],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=ceil(total / page_size) if total > 0 else 1
    )


@router.get("/me", response_model=UserWithRoles)
async def get_current_user_profile(
    current_user: User = Depends(get_current_active_user)
):
    """Get current user's profile."""
    return UserWithRoles.model_validate(current_user)


@router.patch("/me", response_model=UserOut)
async def update_current_user_profile(
    update_data: UserUpdateProfile,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update current user's profile."""
    update_dict = update_data.model_dump(exclude_unset=True)

    for field, value in update_dict.items():
        setattr(current_user, field, value)

    await db.flush()
    await db.refresh(current_user)

    return UserOut.model_validate(current_user)


@router.get("/{user_id}", response_model=UserDetail)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("users:read"))
):
    """Get a specific user by ID. Requires 'users:read' permission."""
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return UserDetail.model_validate(user)


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db)
    # TEMPORARILY DISABLED: current_user: User = Depends(require_permissions("users:create"))
):
    """Create a new user. PUBLIC for testing."""
    stmt = select(User).where(User.email == user_data.email)
    result = await db.execute(stmt)
    existing_user = result.scalars().first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )

    role_stmt = select(Role).where(Role.name == "user")
    role_result = await db.execute(role_stmt)
    default_role = role_result.scalars().first()

    new_user = User(
        firstName=user_data.firstName,
        lastName=user_data.lastName,
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        is_active=True,
        is_verified=True,
        roles=[default_role] if default_role else []
    )

    db.add(new_user)
    await db.flush()
    await db.refresh(new_user)

    return UserOut.model_validate(new_user)


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    update_data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("users:update"))
):
    """Update a user. Requires 'users:update' permission."""
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if user.id == current_user.id and update_data.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account"
        )

    update_dict = update_data.model_dump(exclude_unset=True)

    if "email" in update_dict and update_dict["email"] != user.email:
        email_stmt = select(User).where(User.email == update_dict["email"])
        email_result = await db.execute(email_stmt)
        existing = email_result.scalars().first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already in use"
            )

    for field, value in update_dict.items():
        setattr(user, field, value)

    await db.flush()
    await db.refresh(user)

    return UserOut.model_validate(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("users:delete"))
):
    """Delete a user. Requires 'users:delete' permission."""
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )

    user.is_active = False
    await db.flush()


# ======================
# Role Assignment
# ======================
@router.get("/{user_id}/roles", response_model=UserRolesResponse)
async def get_user_roles(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("users:read", "roles:read"))
):
    """Get roles assigned to a user."""
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return UserRolesResponse(
        user_id=user.id,
        roles=[{"id": r.id, "name": r.name, "description": r.description} for r in user.roles],
        message="Roles retrieved successfully"
    )


@router.put("/{user_id}/roles", response_model=UserRolesResponse)
async def assign_user_roles(
    user_id: int,
    request: AssignRolesRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("users:update", "roles:update"))
):
    """Assign roles to a user (replaces existing roles)."""
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    role_stmt = select(Role).where(Role.id.in_(request.role_ids))
    role_result = await db.execute(role_stmt)
    roles = role_result.scalars().all()

    if len(roles) != len(request.role_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more role IDs are invalid"
        )

    if user.id == current_user.id:
        current_is_admin = any(r.name == "admin" for r in current_user.roles)
        new_has_admin = any(r.name == "admin" for r in roles)
        if current_is_admin and not new_has_admin:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove admin role from yourself"
            )

    user.roles = list(roles)
    await db.flush()
    await db.refresh(user)

    from app.core.cache import invalidate_cache_key
    await invalidate_cache_key(f"rbac:{user.id}")

    return UserRolesResponse(
        user_id=user.id,
        roles=[{"id": r.id, "name": r.name, "description": r.description} for r in user.roles],
        message="Roles updated successfully"
    )
