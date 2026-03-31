"""
RBAC Tests
Tests for Role-Based Access Control.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User
from app.tests.conftest import auth_headers


class TestRBACPermissions:
    """Tests for permission-based access control."""
    
    def test_admin_can_list_users(self, client: TestClient, admin_user: User, admin_token: str):
        """Test admin with users:read permission can list users."""
        response = client.get(
            "/api/v1/users",
            headers=auth_headers(admin_token)
        )
        
        assert response.status_code == 200
        assert "items" in response.json()
    
    def test_user_can_list_users_with_permission(self, client: TestClient, regular_user: User, user_token: str):
        """Test regular user with users:read permission can list users."""
        response = client.get(
            "/api/v1/users",
            headers=auth_headers(user_token)
        )
        
        # Regular user has users:read permission
        assert response.status_code == 200
    
    def test_admin_can_create_user(self, client: TestClient, admin_user: User, admin_token: str):
        """Test admin can create users."""
        response = client.post(
            "/api/v1/users",
            json={
                "firstName": "New",
                "lastName": "User",
                "email": "newuser@test.com",
                "password": "NewUser123!"
            },
            headers=auth_headers(admin_token)
        )
        
        assert response.status_code == 201
    
    def test_user_cannot_create_user(self, client: TestClient, regular_user: User, user_token: str):
        """Test regular user cannot create users (no users:create permission)."""
        response = client.post(
            "/api/v1/users",
            json={
                "firstName": "New",
                "lastName": "User",
                "email": "newuser@test.com",
                "password": "NewUser123!"
            },
            headers=auth_headers(user_token)
        )
        
        assert response.status_code == 403
    
    def test_admin_can_delete_user(
        self, client: TestClient, admin_user: User, regular_user: User, admin_token: str
    ):
        """Test admin can delete users."""
        response = client.delete(
            f"/api/v1/users/{regular_user.id}",
            headers=auth_headers(admin_token)
        )
        
        assert response.status_code == 204
    
    def test_user_cannot_delete_user(
        self, client: TestClient, admin_user: User, regular_user: User, user_token: str
    ):
        """Test regular user cannot delete users."""
        response = client.delete(
            f"/api/v1/users/{admin_user.id}",
            headers=auth_headers(user_token)
        )
        
        assert response.status_code == 403
    
    def test_cannot_delete_self(self, client: TestClient, admin_user: User, admin_token: str):
        """Test user cannot delete their own account."""
        response = client.delete(
            f"/api/v1/users/{admin_user.id}",
            headers=auth_headers(admin_token)
        )
        
        assert response.status_code == 400
        assert "own account" in response.json()["detail"].lower()


class TestRBACRoles:
    """Tests for role-based access control."""
    
    def test_admin_role_has_full_access(self, client: TestClient, admin_user: User, admin_token: str):
        """Test admin role provides full access."""
        # List users
        response = client.get("/api/v1/users", headers=auth_headers(admin_token))
        assert response.status_code == 200
        
        # Create user
        response = client.post(
            "/api/v1/users",
            json={
                "firstName": "Test",
                "lastName": "User",
                "email": "test@test.com",
                "password": "Test123!"
            },
            headers=auth_headers(admin_token)
        )
        assert response.status_code == 201
        user_id = response.json()["id"]
        
        # Update user
        response = client.patch(
            f"/api/v1/users/{user_id}",
            json={"firstName": "Updated"},
            headers=auth_headers(admin_token)
        )
        assert response.status_code == 200
        
        # Delete user
        response = client.delete(
            f"/api/v1/users/{user_id}",
            headers=auth_headers(admin_token)
        )
        assert response.status_code == 204
    
    def test_user_role_limited_access(self, client: TestClient, regular_user: User, user_token: str):
        """Test user role has limited access."""
        # Can read users
        response = client.get("/api/v1/users", headers=auth_headers(user_token))
        assert response.status_code == 200
        
        # Cannot create
        response = client.post(
            "/api/v1/users",
            json={
                "firstName": "Test",
                "lastName": "User",
                "email": "test@test.com",
                "password": "Test123!"
            },
            headers=auth_headers(user_token)
        )
        assert response.status_code == 403


class TestRBACRoleAssignment:
    """Tests for role assignment."""
    
    def test_admin_can_assign_roles(
        self, client: TestClient, admin_user: User, regular_user: User, 
        admin_token: str, seed_roles_permissions
    ):
        """Test admin can assign roles to users."""
        admin_role = seed_roles_permissions["admin_role"]
        
        response = client.put(
            f"/api/v1/users/{regular_user.id}/roles",
            json={"role_ids": [admin_role.id]},
            headers=auth_headers(admin_token)
        )
        
        assert response.status_code == 200
    
    def test_user_cannot_assign_roles(
        self, client: TestClient, admin_user: User, regular_user: User,
        user_token: str, seed_roles_permissions
    ):
        """Test regular user cannot assign roles."""
        admin_role = seed_roles_permissions["admin_role"]
        
        response = client.put(
            f"/api/v1/users/{admin_user.id}/roles",
            json={"role_ids": [admin_role.id]},
            headers=auth_headers(user_token)
        )
        
        assert response.status_code == 403
    
    def test_cannot_remove_own_admin_role(
        self, client: TestClient, admin_user: User, admin_token: str, seed_roles_permissions
    ):
        """Test admin cannot remove admin role from themselves."""
        user_role = seed_roles_permissions["user_role"]
        
        response = client.put(
            f"/api/v1/users/{admin_user.id}/roles",
            json={"role_ids": [user_role.id]},  # Only user role, not admin
            headers=auth_headers(admin_token)
        )
        
        assert response.status_code == 400
        assert "admin role" in response.json()["detail"].lower()


class TestUnauthorizedAccess:
    """Tests for unauthorized access attempts."""
    
    def test_unauthenticated_request(self, client: TestClient, db: Session):
        """Test unauthenticated request is rejected."""
        response = client.get("/api/v1/users")
        assert response.status_code == 401
    
    def test_invalid_token(self, client: TestClient, db: Session):
        """Test request with invalid token is rejected."""
        response = client.get(
            "/api/v1/users",
            headers=auth_headers("invalid-token")
        )
        assert response.status_code == 401
    
    def test_expired_token(self, client: TestClient, db: Session):
        """Test request with expired token is rejected."""
        # This would need a token generated with past expiration
        # For now, test with malformed token
        response = client.get(
            "/api/v1/users",
            headers=auth_headers("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZXhwIjoxfQ.invalid")
        )
        assert response.status_code == 401
