from contextlib import contextmanager
from sqlalchemy.orm import Session
from app.core.database import SyncSessionLocal as SessionLocal
from app.models.permission import Permission
from app.models.role import Role

@contextmanager
def db_session():
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

DEFAULT_PERMISSIONS = [
    # Users
    "users:read",
    "users:create",
    "users:update",
    "users:delete",
    # Roles
    "roles:read",
    "roles:create",
    "roles:update",
    "roles:delete",
    # Permissions
    "permissions:read",
    "permissions:create",
    "permissions:update",
    "permissions:delete",
]

ROLE_MATRIX = {
    # role -> list of permission codes
    "admin": DEFAULT_PERMISSIONS,          # full access
    "user": ["users:read"],                # read-only example
}

def _get_or_create_permission(db: Session, code: str) -> Permission:
    code = code.strip().lower()
    obj = db.query(Permission).filter(Permission.code == code).first()
    if not obj:
        obj = Permission(code=code, label=code.replace(":", " ").title())
        db.add(obj)
    return obj

def _get_or_create_role(db: Session, name: str, description: str | None = None) -> Role:
    name = name.strip().lower()
    obj = db.query(Role).filter(Role.name == name).first()
    if not obj:
        obj = Role(name=name, description=description)
        db.add(obj)
    return obj

def seed_permissions_and_roles():
    with db_session() as db:
        # Ensure permissions
        perms = {code: _get_or_create_permission(db, code) for code in DEFAULT_PERMISSIONS}

        # Ensure roles and attach permissions
        for role_name, perm_codes in ROLE_MATRIX.items():
            role = _get_or_create_role(db, role_name)
            role.permissions = [perms[c] for c in set(perm_codes)]
            db.add(role)

        print("✅ RBAC seeded: roles & permissions")

if __name__ == "__main__":
    seed_permissions_and_roles()
