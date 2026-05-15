"""Insert default 'user' platform role on signup + backfill.

Revision ID: 008_insert_default_user_role
Revises: 007_default_user_platform_role
Create Date: 2026-05-15

Today every regular signup ends up with NO row in `user_platform_roles`;
`get_platform_role()` falls back to the string 'user' when the lookup is
empty. That works, but it means we can't tell "implicit user" apart from
"unprovisioned" in the database, and admin tooling can't enumerate users
by role.

This migration:
  1. Rewrites `handle_new_user()` so that, after creating the profile row,
     it also inserts a 'user' row into `user_platform_roles` (idempotent
     via ON CONFLICT DO NOTHING). The trigger remains SECURITY DEFINER.
  2. Backfills `user_platform_roles` for every existing `auth.users` row
     that doesn't already have one. Existing admin/staff rows are left
     untouched.

Authorization behavior is unchanged: `get_platform_role()` still returns
the same string, and no existing check requires the literal 'user' role.
Migration 007 separately ensures 'user' is a valid enum value before
this runs (Postgres rejects newly-added enum values referenced inside
the same transaction that added them).
"""
from typing import Sequence, Union

from alembic import op


revision: str = "008_insert_default_user_role"
down_revision: Union[str, None] = "007_default_user_platform_role"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Rewrite trigger: profile + default 'user' role in one go.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.handle_new_user()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $$
        BEGIN
            INSERT INTO public.profiles (
                id, first_name, last_name, claimed_at, created_at, updated_at
            )
            VALUES (
                NEW.id,
                NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'firstName', '')), ''),
                NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'lastName',  '')), ''),
                NOW(), NOW(), NOW()
            )
            ON CONFLICT (id) DO NOTHING;

            INSERT INTO public.user_platform_roles (user_id, role, granted_at)
            VALUES (NEW.id, 'user', NOW())
            ON CONFLICT (user_id) DO NOTHING;

            RETURN NEW;
        END;
        $$;
        """
    )

    # 2. Backfill — anyone in auth.users without a role row gets 'user'.
    op.execute(
        """
        INSERT INTO public.user_platform_roles (user_id, role, granted_at)
        SELECT u.id, 'user'::platform_role, NOW()
        FROM auth.users u
        LEFT JOIN public.user_platform_roles r ON r.user_id = u.id
        WHERE r.user_id IS NULL
        """
    )


def downgrade() -> None:
    # 1. Restore the previous trigger (no role insert).
    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.handle_new_user()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $$
        BEGIN
            INSERT INTO public.profiles (
                id, first_name, last_name, claimed_at, created_at, updated_at
            )
            VALUES (
                NEW.id,
                NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'firstName', '')), ''),
                NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'lastName',  '')), ''),
                NOW(), NOW(), NOW()
            )
            ON CONFLICT (id) DO NOTHING;
            RETURN NEW;
        END;
        $$;
        """
    )

    # 2. Remove only the rows this migration created — keep explicit admin/staff.
    op.execute(
        "DELETE FROM public.user_platform_roles WHERE role = 'user'"
    )
