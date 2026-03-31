"""
Authentication Tests
Tests for login, register, password reset, and token management.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User
from app.core.security import hash_password
from app.tests.conftest import auth_headers


class TestLogin:
    """Tests for login endpoint."""
    
    def test_login_success(self, client: TestClient, admin_user: User):
        """Test successful login."""
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "Admin123!"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "tokens" in data
        assert "access_token" in data["tokens"]
        assert "refresh_token" in data["tokens"]
        assert data["user"]["email"] == "admin@test.com"
    
    def test_login_wrong_password(self, client: TestClient, admin_user: User):
        """Test login with wrong password."""
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "wrongpassword"}
        )
        
        assert response.status_code == 401
        assert "Incorrect email or password" in response.json()["detail"]
    
    def test_login_nonexistent_user(self, client: TestClient, db: Session):
        """Test login with non-existent user."""
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "nonexistent@test.com", "password": "password123"}
        )
        
        assert response.status_code == 401
    
    def test_login_inactive_user(self, client: TestClient, db: Session, seed_roles_permissions):
        """Test login with inactive user."""
        user = User(
            firstName="Inactive",
            lastName="User",
            email="inactive@test.com",
            hashed_password=hash_password("Password123!"),
            is_active=False,
            roles=[seed_roles_permissions["user_role"]]
        )
        db.add(user)
        db.commit()
        
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "inactive@test.com", "password": "Password123!"}
        )
        
        assert response.status_code == 403
        assert "disabled" in response.json()["detail"].lower()


class TestRegistration:
    """Tests for registration endpoint."""
    
    def test_register_success(self, client: TestClient, seed_roles_permissions):
        """Test successful registration."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "firstName": "New",
                "lastName": "User",
                "email": "newuser@test.com",
                "password": "NewUser123!",
                "password_confirm": "NewUser123!"
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["user"]["email"] == "newuser@test.com"
        assert "tokens" in data
    
    def test_register_duplicate_email(self, client: TestClient, admin_user: User):
        """Test registration with existing email."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "firstName": "Duplicate",
                "lastName": "User",
                "email": "admin@test.com",  # Already exists
                "password": "Password123!",
                "password_confirm": "Password123!"
            }
        )
        
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"].lower()
    
    def test_register_password_mismatch(self, client: TestClient, seed_roles_permissions):
        """Test registration with mismatched passwords."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "firstName": "Test",
                "lastName": "User",
                "email": "test@test.com",
                "password": "Password123!",
                "password_confirm": "DifferentPassword123!"
            }
        )
        
        assert response.status_code == 422  # Validation error
    
    def test_register_weak_password(self, client: TestClient, seed_roles_permissions):
        """Test registration with weak password."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "firstName": "Test",
                "lastName": "User",
                "email": "test@test.com",
                "password": "weak",
                "password_confirm": "weak"
            }
        )
        
        assert response.status_code == 422  # Validation error


class TestTokenRefresh:
    """Tests for token refresh endpoint."""
    
    def test_refresh_token_success(self, client: TestClient, admin_user: User):
        """Test successful token refresh."""
        # First login to get tokens
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "Admin123!"}
        )
        refresh_token = login_response.json()["tokens"]["refresh_token"]
        
        # Refresh the token
        response = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
    
    def test_refresh_token_invalid(self, client: TestClient, db: Session):
        """Test refresh with invalid token."""
        response = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "invalid-token"}
        )
        
        assert response.status_code == 401


class TestPasswordReset:
    """Tests for password reset endpoints."""
    
    def test_forgot_password_existing_user(self, client: TestClient, admin_user: User):
        """Test forgot password for existing user."""
        response = client.post(
            "/api/v1/auth/forgot-password",
            json={"email": "admin@test.com"}
        )
        
        # Should always return success to prevent email enumeration
        assert response.status_code == 200
    
    def test_forgot_password_nonexistent_user(self, client: TestClient, db: Session):
        """Test forgot password for non-existent user."""
        response = client.post(
            "/api/v1/auth/forgot-password",
            json={"email": "nonexistent@test.com"}
        )
        
        # Should still return success (security best practice)
        assert response.status_code == 200
    
    def test_reset_password_invalid_token(self, client: TestClient, db: Session):
        """Test reset password with invalid token."""
        response = client.post(
            "/api/v1/auth/reset-password",
            json={
                "token": "invalid-token",
                "password": "NewPassword123!",
                "password_confirm": "NewPassword123!"
            }
        )
        
        assert response.status_code == 400


class TestChangePassword:
    """Tests for change password endpoint."""
    
    def test_change_password_success(self, client: TestClient, admin_user: User, admin_token: str):
        """Test successful password change."""
        response = client.post(
            "/api/v1/auth/change-password",
            json={
                "current_password": "Admin123!",
                "new_password": "NewAdmin123!",
                "new_password_confirm": "NewAdmin123!"
            },
            headers=auth_headers(admin_token)
        )
        
        assert response.status_code == 200
        
        # Verify can login with new password
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "NewAdmin123!"}
        )
        assert login_response.status_code == 200
    
    def test_change_password_wrong_current(self, client: TestClient, admin_user: User, admin_token: str):
        """Test change password with wrong current password."""
        response = client.post(
            "/api/v1/auth/change-password",
            json={
                "current_password": "wrongpassword",
                "new_password": "NewPassword123!",
                "new_password_confirm": "NewPassword123!"
            },
            headers=auth_headers(admin_token)
        )
        
        assert response.status_code == 400
    
    def test_change_password_unauthenticated(self, client: TestClient, db: Session):
        """Test change password without authentication."""
        response = client.post(
            "/api/v1/auth/change-password",
            json={
                "current_password": "password",
                "new_password": "NewPassword123!",
                "new_password_confirm": "NewPassword123!"
            }
        )
        
        assert response.status_code == 401


class TestCurrentUser:
    """Tests for current user endpoint."""
    
    def test_get_current_user(self, client: TestClient, admin_user: User, admin_token: str):
        """Test getting current user info."""
        response = client.get(
            "/api/v1/auth/me",
            headers=auth_headers(admin_token)
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "admin@test.com"
        assert "admin" in data["roles"]
    
    def test_get_current_user_unauthenticated(self, client: TestClient, db: Session):
        """Test getting current user without authentication."""
        response = client.get("/api/v1/auth/me")
        
        assert response.status_code == 401
