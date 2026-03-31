"""
Role-Based Access Control (RBAC) Service
Provides FastAPI dependencies for role and permission-based authorization.
"""
from typing import Iterable, Sequence, Callable
from fastapi import Depends, HTTPException, status

from app.core.config import settings
from app.models.user import User

# Import the unified get_current_user (supports both JWT and OAuth2)
from app.core.security import get_current_user


# ======================
# Role Check Functions
# ======================
def has_role(user: User, role_name: str) -> bool:
    """Check if a user has a specific role."""
    role_name = (role_name or "").strip().lower()
    if hasattr(user, "_cached_roles"):
        return role_name in user._cached_roles
    return any(r.name == role_name for r in getattr(user, "roles", []))


def has_any_role(user: User, roles: Iterable[str]) -> bool:
    """Check if a user has any of the specified roles."""
    normalized = {r.strip().lower() for r in roles if r and r.strip()}
    if hasattr(user, "_cached_roles"):
        return any(r in normalized for r in user._cached_roles)
    return any(r.name in normalized for r in getattr(user, "roles", []))


def has_all_roles(user: User, roles: Iterable[str]) -> bool:
    """Check if a user has all of the specified roles."""
    needed = {r.strip().lower() for r in roles if r and r.strip()}
    if not needed:
        return True
    if hasattr(user, "_cached_roles"):
        owned = set(user._cached_roles)
        return needed.issubset(owned)
    owned = {r.name for r in getattr(user, "roles", [])}
    return needed.issubset(owned)


# ======================
# Permission Check Functions
# ======================
def has_permission(user: User, permission_code: str) -> bool:
    """Check if a user has a specific permission through any of their roles.""" 
    target = (permission_code or "").strip().lower()
    if hasattr(user, "_cached_permissions"):
        return target in user._cached_permissions
    for role in getattr(user, "roles", []):
        if any(p.code == target for p in getattr(role, "permissions", [])):     
            return True
    return False


def has_any_permission(user: User, permission_codes: Sequence[str]) -> bool:    
    """Check if a user has any of the specified permissions."""
    needed = {c.strip().lower() for c in permission_codes if c and c.strip()}   
    if not needed:
        return True
    if hasattr(user, "_cached_permissions"):
        return any(p in needed for p in user._cached_permissions)
    for role in getattr(user, "roles", []):
        for perm in getattr(role, "permissions", []):
            if perm.code in needed:
                return True
    return False


def has_all_permissions(user: User, permission_codes: Sequence[str]) -> bool:   
    """Check if a user has all of the specified permissions."""
    needed = {c.strip().lower() for c in permission_codes if c and c.strip()}   
    if not needed:
        return True
    if hasattr(user, "_cached_permissions"):
        owned = set(user._cached_permissions)
        return needed.issubset(owned)
        
    for role in getattr(user, "roles", []):
        for perm in getattr(role, "permissions", []):
            if perm.code in needed:
                needed.remove(perm.code)
            if not needed:
                return True
                
    return len(needed) == 0

# ======================
# FastAPI Dependencies
# ======================
def require_roles(*roles: str, require_all: bool = False) -> Callable:
    """
    FastAPI dependency factory for role-based authorization.

    Usage:
        @router.get("/admin")
        async def admin_only(user = Depends(require_roles("admin"))):
            ...
    """
    async def dependency(user: User = Depends(get_current_user)) -> User:
        if not settings.ENABLE_RBAC:
            return user
        if not roles:
            return user
        if require_all:
            if has_all_roles(user, roles):
                return user
        else:
            if has_any_role(user, roles):
                return user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient role privileges"
        )

    return dependency


def require_permissions(*permissions: str, require_all: bool = True) -> Callable:
    """
    FastAPI dependency factory for permission-based authorization.

    Usage:
        @router.delete("/users/{id}")
        async def delete_user(user = Depends(require_permissions("users:delete"))):
            ...
    """
    async def dependency(user: User = Depends(get_current_user)) -> User:
        if not settings.ENABLE_RBAC:
            return user
        if not permissions:
            return user
        if require_all:
            if has_all_permissions(user, permissions):
                return user
        else:
            if has_any_permission(user, permissions):
                return user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Missing required permission"
        )

    return dependency


def require_any(*requirements: str) -> Callable:
    """
    FastAPI dependency that accepts either roles or permissions.
    Format: "role:admin" or "perm:users:delete"
    """
    roles = []
    permissions = []

    for req in requirements:
        if req.startswith("role:"):
            roles.append(req[5:])
        elif req.startswith("perm:"):
            permissions.append(req[5:])

    async def dependency(user: User = Depends(get_current_user)) -> User:
        if not settings.ENABLE_RBAC:
            return user
        if not roles and not permissions:
            return user
        if roles and has_any_role(user, roles):
            return user
        if permissions and has_any_permission(user, permissions):
            return user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    return dependency
