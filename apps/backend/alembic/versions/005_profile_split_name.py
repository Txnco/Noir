"""Split profiles.full_name into first_name / last_name.

Revision ID: 005_profile_split_name
Revises: 004_supabase_auth_profiles
Create Date: 2026-04-16

Makes `profiles` the single source of truth for display name. Adds
`first_name`/`last_name`, backfills from the old `full_name` column,
drops `full_name`, and rewrites `handle_new_user()` to populate the
new columns from the signup metadata Supabase stores on `auth.users`.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "005_profile_split_name"
down_revision: Union[str, None] = "004_supabase_auth_profiles"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name VARCHAR(100)")
    op.execute("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name  VARCHAR(100)")

    op.execute(
        """
        UPDATE profiles
        SET first_name = NULLIF(split_part(full_name, ' ', 1), ''),
            last_name  = NULLIF(regexp_replace(full_name, '^\\S+\\s*', ''), '')
        WHERE full_name IS NOT NULL
          AND (first_name IS NULL AND last_name IS NULL)
        """
    )

    op.execute("ALTER TABLE profiles DROP COLUMN IF EXISTS full_name")

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


def downgrade() -> None:
    op.execute("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name VARCHAR(255)")
    op.execute(
        """
        UPDATE profiles
        SET full_name = NULLIF(TRIM(
            COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')
        ), '')
        WHERE full_name IS NULL
        """
    )
    op.execute("ALTER TABLE profiles DROP COLUMN IF EXISTS first_name")
    op.execute("ALTER TABLE profiles DROP COLUMN IF EXISTS last_name")

    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.handle_new_user()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $$
        BEGIN
            INSERT INTO public.profiles (id, full_name, claimed_at, created_at, updated_at)
            VALUES (
                NEW.id,
                NULLIF(TRIM(
                    COALESCE(NEW.raw_user_meta_data->>'firstName', '') || ' ' ||
                    COALESCE(NEW.raw_user_meta_data->>'lastName',  '')
                ), ''),
                NOW(), NOW(), NOW()
            )
            ON CONFLICT (id) DO NOTHING;
            RETURN NEW;
        END;
        $$;
        """
    )
