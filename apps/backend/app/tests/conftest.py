"""
Test configuration — minimal harness.

Auth is owned by Supabase; we don't exercise login/register in unit tests.
Tests that hit authenticated endpoints should mock `get_current_user` via
`app.dependency_overrides`.
"""
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-testing-only-minimum-32-chars-long!")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-supabase-jwt-secret-for-testing-only!")
os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("REDIS_ENABLED", "false")
os.environ.setdefault("RATE_LIMIT_ENABLED", "false")
