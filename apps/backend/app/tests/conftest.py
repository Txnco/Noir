"""
Test Configuration
Pytest fixtures and test database setup.

Uses dual-engine pattern:
  - Sync engine for fixture setup (seeding test data)
  - Async engine for app routes via get_db override
Both point to the same file-based SQLite database.
"""
import os
import pytest
from typing import Generator
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

# Set test environment variables before importing app
os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only-minimum-32-chars-long!"
os.environ["JWT_SECRET_KEY"] = "test-jwt-secret-key-for-testing-only-minimum-32-chars!"
os.environ["ENABLE_LOCAL_AUTH"] = "true"
os.environ["ENABLE_OAUTH2"] = "false"
os.environ["DEBUG"] = "true"
os.environ["REDIS_ENABLED"] = "false"
os.environ["RATE_LIMIT_ENABLED"] = "false"

from app.main import app
from app.core.database import get_db
from app.models.base import Base
from app.models.user import User
from app.models.role import Role
from app.models.permission import Permission
from app.core.security import hash_password


# =============================================================================
# Test Database Setup (Dual Engine)
# =============================================================================
_TEST_DB_PATH = os.path.join(os.path.dirname(__file__), "test.db")
_SYNC_URL = f"sqlite:///{_TEST_DB_PATH}"
_ASYNC_URL = f"sqlite+aiosqlite:///{_TEST_DB_PATH}"

# Sync engine — used by fixtures to seed test data
sync_engine = create_engine(
    _SYNC_URL,
    connect_args={"check_same_thread": False},
)
SyncTestingSession = sessionmaker(bind=sync_engine, autoflush=False, autocommit=False)

# Async engine — used by app routes via get_db override
async_engine = create_async_engine(
    _ASYNC_URL,
    connect_args={"check_same_thread": False},
)
AsyncTestingSession = async_sessionmaker(
    async_engine, class_=AsyncSession, expire_on_commit=False,
)


async def override_get_db():
    """Async get_db override for testing."""
    async with AsyncTestingSession() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# Override the get_db dependency
app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="function")
def db() -> Generator[Session, None, None]:
    """
    Create a fresh database for each test.
    Sync session for fixture setup; async sessions serve the app.
    """
    Base.metadata.create_all(bind=sync_engine)
    session = SyncTestingSession()

    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=sync_engine)
        sync_engine.dispose()
        # Clean up test db file
        if os.path.exists(_TEST_DB_PATH):
            try:
                os.remove(_TEST_DB_PATH)
            except OSError:
                pass


@pytest.fixture(scope="function")
def client(db: Session) -> Generator[TestClient, None, None]:
    """
    Create a test client with a fresh database.
    """
    yield TestClient(app)


@pytest.fixture(scope="function")
def seed_roles_permissions(db: Session) -> dict:
    """
    Seed roles and permissions for testing.
    """
    # Create permissions
    permissions = {}
    for code in ["users:read", "users:create", "users:update", "users:delete"]:
        perm = Permission(code=code, label=code.replace(":", " ").title())
        db.add(perm)
        permissions[code] = perm

    # Create roles
    admin_role = Role(name="admin", description="Administrator")
    admin_role.permissions = list(permissions.values())
    db.add(admin_role)

    user_role = Role(name="user", description="Regular user")
    user_role.permissions = [permissions["users:read"]]
    db.add(user_role)

    db.commit()

    return {
        "admin_role": admin_role,
        "user_role": user_role,
        "permissions": permissions
    }


@pytest.fixture(scope="function")
def admin_user(db: Session, seed_roles_permissions: dict) -> User:
    """
    Create an admin user for testing.
    """
    user = User(
        firstName="Admin",
        lastName="Test",
        email="admin@test.com",
        hashed_password=hash_password("Admin123!"),
        is_active=True,
        is_verified=True,
        roles=[seed_roles_permissions["admin_role"]]
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture(scope="function")
def regular_user(db: Session, seed_roles_permissions: dict) -> User:
    """
    Create a regular user for testing.
    """
    user = User(
        firstName="Regular",
        lastName="Test",
        email="user@test.com",
        hashed_password=hash_password("User123!"),
        is_active=True,
        is_verified=True,
        roles=[seed_roles_permissions["user_role"]]
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture(scope="function")
def admin_token(client: TestClient, admin_user: User) -> str:
    """
    Get an authentication token for the admin user.
    """
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@test.com", "password": "Admin123!"}
    )
    return response.json()["tokens"]["access_token"]


@pytest.fixture(scope="function")
def user_token(client: TestClient, regular_user: User) -> str:
    """
    Get an authentication token for the regular user.
    """
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "user@test.com", "password": "User123!"}
    )
    return response.json()["tokens"]["access_token"]


def auth_headers(token: str) -> dict:
    """Create authorization headers."""
    return {"Authorization": f"Bearer {token}"}
