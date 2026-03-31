"""
User Seeder
Seeds default users with RBAC roles for testing/development.
"""
from contextlib import contextmanager
from app.core.database import SyncSessionLocal as SessionLocal
from app.models.user import User
from app.models.role import Role
from app.core.security import hash_password


@contextmanager
def db_session():
    """Database session context manager."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# Default users to seed
DEFAULT_USERS = [
    {
        "firstName": "Admin",
        "lastName": "User",
        "email": "admin@example.com",
        "password": "Admin123!",  # Change in production!
        "is_verified": True,
        "role": "admin"
    },
    {
        "firstName": "Test",
        "lastName": "User",
        "email": "user@example.com",
        "password": "User123!",  # Change in production!
        "is_verified": True,
        "role": "user"
    },
]


def seed_users():
    """
    Seed default users with RBAC roles.
    Creates an admin user and a regular user for testing.
    """
    with db_session() as db:
        inserted = []
        updated = []
        
        for user_data in DEFAULT_USERS:
            # Check if user exists
            existing_user = db.query(User).filter(User.email == user_data["email"]).first()
            
            # Get role
            role = db.query(Role).filter(Role.name == user_data["role"]).first()
            
            if existing_user:
                # Update existing user's role if needed
                if role and role not in existing_user.roles:
                    existing_user.roles.append(role)
                    updated.append(user_data["email"])
            else:
                # Create new user
                new_user = User(
                    firstName=user_data["firstName"],
                    lastName=user_data["lastName"],
                    email=user_data["email"],
                    hashed_password=hash_password(user_data["password"]),
                    is_active=True,
                    is_verified=user_data.get("is_verified", False),
                    roles=[role] if role else []
                )
                db.add(new_user)
                inserted.append(user_data["email"])
        
        if inserted:
            print(f"✅ Users created: {inserted}")
        if updated:
            print(f"✅ Users updated with roles: {updated}")
        if not inserted and not updated:
            print("⚠️  No new users to seed. All users already exist with correct roles.")


def seed_all():
    """Seed all data (permissions, roles, and users)."""
    from app.seeders.seed_permissions_roles import seed_permissions_and_roles
    
    print("🌱 Starting database seeding...")
    print("-" * 40)
    
    # First seed permissions and roles
    seed_permissions_and_roles()
    
    # Then seed users
    seed_users()
    
    print("-" * 40)
    print("✅ Database seeding completed!")
    print("\n📋 Default accounts:")
    print("   Admin: admin@example.com / Admin123!")
    print("   User:  user@example.com / User123!")


if __name__ == "__main__":
    seed_all()

