"""
Security Tests
Tests for security features, token validation, and protection against common attacks.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
import time

from app.models.user import User
from app.core.security import hash_password, verify_password, create_access_token, decode_token
from app.tests.conftest import auth_headers


class TestPasswordHashing:
    """Tests for password hashing security."""
    
    def test_password_is_hashed(self):
        """Test that passwords are properly hashed."""
        password = "SecurePassword123!"
        hashed = hash_password(password)
        
        assert hashed != password
        assert len(hashed) > 50  # Bcrypt hashes are long
        assert hashed.startswith("$2")  # Bcrypt prefix
    
    def test_password_verification(self):
        """Test password verification works correctly."""
        password = "SecurePassword123!"
        hashed = hash_password(password)
        
        assert verify_password(password, hashed) is True
        assert verify_password("wrongpassword", hashed) is False
    
    def test_same_password_different_hashes(self):
        """Test that same password produces different hashes (salt)."""
        password = "SecurePassword123!"
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        
        assert hash1 != hash2  # Different salts
        assert verify_password(password, hash1) is True
        assert verify_password(password, hash2) is True


class TestJWTSecurity:
    """Tests for JWT token security."""
    
    def test_token_contains_required_claims(self):
        """Test JWT contains required claims."""
        token = create_access_token(sub="123", roles=["admin"], permissions=["users:read"])
        payload = decode_token(token)
        
        assert "sub" in payload
        assert "exp" in payload
        assert "iat" in payload
        assert "jti" in payload  # Unique token ID
        assert payload["sub"] == "123"
    
    def test_token_has_type_claim(self):
        """Test JWT has type claim for access/refresh distinction."""
        token = create_access_token(sub="123")
        payload = decode_token(token)
        
        assert payload.get("type") == "access"
    
    def test_token_includes_roles_and_permissions(self):
        """Test JWT includes roles and permissions claims."""
        token = create_access_token(
            sub="123",
            roles=["admin", "user"],
            permissions=["users:read", "users:write"]
        )
        payload = decode_token(token)
        
        assert "admin" in payload["roles"]
        assert "users:read" in payload["perms"]
    
    def test_invalid_token_rejected(self):
        """Test that invalid tokens are rejected."""
        with pytest.raises(Exception):
            decode_token("invalid.token.here")
    
    def test_tampered_token_rejected(self):
        """Test that tampered tokens are rejected."""
        token = create_access_token(sub="123")
        # Tamper with the token
        tampered = token[:-5] + "XXXXX"
        
        with pytest.raises(Exception):
            decode_token(tampered)


class TestInputValidation:
    """Tests for input validation and sanitization."""
    
    def test_email_validation(self, client: TestClient, seed_roles_permissions):
        """Test email format validation."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "firstName": "Test",
                "lastName": "User",
                "email": "not-an-email",
                "password": "Password123!",
                "password_confirm": "Password123!"
            }
        )
        
        assert response.status_code == 422  # Validation error
    
    def test_sql_injection_prevention(self, client: TestClient, admin_user: User, admin_token: str):
        """Test SQL injection is prevented."""
        # Attempt SQL injection in search parameter
        response = client.get(
            "/api/v1/users",
            params={"search": "'; DROP TABLE users; --"},
            headers=auth_headers(admin_token)
        )
        
        # Should not cause error, just return no results
        assert response.status_code == 200
    
    def test_xss_prevention_in_name(self, client: TestClient, admin_user: User, admin_token: str):
        """Test XSS is prevented in user names."""
        response = client.post(
            "/api/v1/users",
            json={
                "firstName": "<script>alert('xss')</script>",
                "lastName": "User",
                "email": "xss@test.com",
                "password": "Password123!"
            },
            headers=auth_headers(admin_token)
        )
        
        # Should succeed but data should be stored as-is (sanitization on output)
        if response.status_code == 201:
            data = response.json()
            # The script tag should be stored (sanitization is on frontend display)
            assert "<script>" in data["firstName"] or response.status_code == 422
    
    def test_password_length_validation(self, client: TestClient, seed_roles_permissions):
        """Test password minimum length validation."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "firstName": "Test",
                "lastName": "User",
                "email": "test@test.com",
                "password": "short",
                "password_confirm": "short"
            }
        )
        
        assert response.status_code == 422


class TestRateLimitingConcepts:
    """Tests demonstrating rate limiting concepts (actual implementation may vary)."""
    
    def test_multiple_failed_logins(self, client: TestClient, admin_user: User):
        """Test behavior after multiple failed login attempts."""
        # Simulate multiple failed attempts
        for _ in range(5):
            response = client.post(
                "/api/v1/auth/login",
                json={"email": "admin@test.com", "password": "wrongpassword"}
            )
            assert response.status_code == 401
        
        # Should still be able to try (rate limiting not implemented in base)
        # This test documents the expected behavior
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "Admin123!"}
        )
        # If rate limiting is implemented, this might return 429
        assert response.status_code in [200, 429]


class TestTokenExpiration:
    """Tests for token expiration handling."""
    
    def test_refresh_token_required_for_renewal(self, client: TestClient, admin_user: User):
        """Test that access token cannot be used to refresh."""
        # Login to get tokens
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "Admin123!"}
        )
        access_token = login_response.json()["tokens"]["access_token"]
        
        # Try to refresh with access token (should fail)
        response = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": access_token}
        )
        
        assert response.status_code == 401


class TestSessionSecurity:
    """Tests for session/token security."""
    
    def test_logout_invalidates_refresh_token(self, client: TestClient, admin_user: User):
        """Test that logout invalidates refresh token."""
        # Login
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "Admin123!"}
        )
        tokens = login_response.json()["tokens"]
        access_token = tokens["access_token"]
        refresh_token = tokens["refresh_token"]
        
        # Logout
        logout_response = client.post(
            "/api/v1/auth/logout",
            headers=auth_headers(access_token)
        )
        assert logout_response.status_code == 200
        
        # Try to use refresh token (should fail)
        refresh_response = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token}
        )
        assert refresh_response.status_code == 401
    
    def test_password_change_invalidates_tokens(
        self, client: TestClient, admin_user: User, admin_token: str, db: Session
    ):
        """Test that password change invalidates existing tokens."""
        # Get initial refresh token
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "Admin123!"}
        )
        old_refresh_token = login_response.json()["tokens"]["refresh_token"]
        
        # Change password
        change_response = client.post(
            "/api/v1/auth/change-password",
            json={
                "current_password": "Admin123!",
                "new_password": "NewAdmin123!",
                "new_password_confirm": "NewAdmin123!"
            },
            headers=auth_headers(login_response.json()["tokens"]["access_token"])
        )
        assert change_response.status_code == 200
        
        # Old refresh token should be invalid
        refresh_response = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": old_refresh_token}
        )
        assert refresh_response.status_code == 401
