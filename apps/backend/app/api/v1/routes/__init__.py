"""
API v1 Routes Package
"""
from app.api.v1.routes import auth_routes, user_routes, admin_routes

__all__ = ["auth_routes", "user_routes", "admin_routes"]
