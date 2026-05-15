"""Grant (or revoke) the platform `super_admin` role for a user.

One-shot bootstrap tool — the first Noir platform admin has to be created
manually, since authority can only be granted by someone who already has it.

Usage:
    python scripts/grant_super_admin.py <email>
    python scripts/grant_super_admin.py <email> --role support
    python scripts/grant_super_admin.py <email> --revoke

The user must already exist (have signed up) — this only layers a row onto
`user_platform_roles`. Identity itself is owned by Supabase `auth.users`.
"""
import argparse
import os
import sys

from dotenv import load_dotenv
from sqlalchemy import MetaData, Table, create_engine, select
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

PLATFORM_ROLES = ("super_admin", "support", "finance_admin", "user")

load_dotenv()


def main() -> int:
    parser = argparse.ArgumentParser(description="Grant a platform role to a user.")
    parser.add_argument("email", help="Email of the (already registered) user.")
    parser.add_argument(
        "--role",
        default="super_admin",
        choices=PLATFORM_ROLES,
        help="Platform role to grant (default: super_admin).",
    )
    parser.add_argument(
        "--revoke",
        action="store_true",
        help="Reset the user back to the plain 'user' role instead of granting.",
    )
    args = parser.parse_args()

    url_str = os.getenv("DATABASE_URL")
    if not url_str:
        print("ERROR: DATABASE_URL not set in environment / .env", file=sys.stderr)
        return 1

    target_role = "user" if args.revoke else args.role

    sync_url = make_url(url_str).set(drivername="postgresql")
    engine = create_engine(sync_url)
    metadata = MetaData()

    try:
        profiles = Table("profiles", metadata, autoload_with=engine)
        roles = Table("user_platform_roles", metadata, autoload_with=engine)
    except Exception as exc:  # noqa: BLE001 - surface the connection error plainly
        print(f"ERROR: could not load tables: {exc}", file=sys.stderr)
        return 1

    with Session(engine) as session:
        user_id = session.execute(
            select(profiles.c.id).where(profiles.c.email == args.email)
        ).scalar_one_or_none()

        if user_id is None:
            print(
                f"ERROR: no user found with email '{args.email}'. "
                "They must sign up first.",
                file=sys.stderr,
            )
            return 1

        existing = session.execute(
            select(roles.c.role).where(roles.c.user_id == user_id)
        ).scalar_one_or_none()

        if existing == target_role:
            print(f"No change — '{args.email}' already has role '{target_role}'.")
            return 0

        if existing is None:
            session.execute(
                roles.insert().values(user_id=user_id, role=target_role)
            )
        else:
            session.execute(
                roles.update()
                .where(roles.c.user_id == user_id)
                .values(role=target_role)
            )
        session.commit()

    verb = "Revoked → 'user'" if args.revoke else f"Granted '{target_role}'"
    print(f"{verb} for {args.email} ({user_id}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
