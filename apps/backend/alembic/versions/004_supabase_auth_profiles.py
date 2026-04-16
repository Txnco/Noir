"""Move to Supabase-native auth: drop local users/roles/permissions, add profiles.

Revision ID: 004_supabase_auth_profiles
Revises: 8b1c68699230
Create Date: 2026-04-16

This migration commits the backend to Supabase as the sole identity provider:
  - Drops the legacy local `users`, `user_roles`, `roles`, `permissions`,
    `role_permissions` tables (all password + RBAC state Supabase now owns).
  - Creates `profiles` keyed by `auth.users.id` (1:1, cascade delete).
  - Creates `user_platform_roles` (platform-wide) and `organization_members`
    (org-scoped) for authorization, both keyed to `auth.users.id`.
  - Creates `user_preferences` extension table.
  - Installs `handle_new_user()` trigger on `auth.users` so profile rows are
    auto-created on sign-up — keeping auth and profile in lockstep.
  - Retypes `audit_logs.actor_id` to UUID to match Supabase identities.

Assumes the database already has the `auth` schema (i.e. it's a Supabase
Postgres instance).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "004_supabase_auth_profiles"
down_revision: Union[str, None] = "8b1c68699230"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -----------------------------------------------------------------
    # 1. Drop legacy local auth / RBAC tables.
    # -----------------------------------------------------------------
    # Order matters: M2M tables first, then their parents.
    op.execute("DROP TABLE IF EXISTS user_roles CASCADE")
    op.execute("DROP TABLE IF EXISTS role_permissions CASCADE")
    op.execute("DROP TABLE IF EXISTS users CASCADE")
    op.execute("DROP TABLE IF EXISTS roles CASCADE")
    op.execute("DROP TABLE IF EXISTS permissions CASCADE")

    # -----------------------------------------------------------------
    # 2. Retype audit_logs.actor_id → UUID (was Integer).
    # -----------------------------------------------------------------
    # audit_logs data is preserved where possible; rows with non-UUID
    # actor_ids (from the legacy integer scheme) are nulled out rather
    # than crashing the migration.
    op.execute("ALTER TABLE audit_logs ALTER COLUMN actor_id DROP DEFAULT")
    op.execute(
        """
        ALTER TABLE audit_logs
        ALTER COLUMN actor_id TYPE UUID
        USING NULL
        """
    )
    # Also bump id → UUID if it's still a string (optional cleanup).
    # We skip this to avoid data loss; audit_logs.id stays VARCHAR(36).

    # -----------------------------------------------------------------
    # 3. Enums for platform / org roles.
    # -----------------------------------------------------------------
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE platform_role AS ENUM ('admin','staff','user'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; END $$"
    )
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE org_member_role AS ENUM ('owner','admin','staff'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; END $$"
    )

    # -----------------------------------------------------------------
    # 4. profiles — PK == auth.users.id, cascade delete.
    # -----------------------------------------------------------------
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS profiles (
            id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            full_name     VARCHAR(255),
            avatar_url    TEXT,
            date_of_birth DATE,
            phone         VARCHAR(50),
            city          VARCHAR(100),
            claimed_at    TIMESTAMPTZ,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_profiles_unclaimed "
        "ON profiles(id) WHERE claimed_at IS NULL"
    )

    # -----------------------------------------------------------------
    # 5. user_platform_roles — platform-wide role, FK to auth.users.
    # -----------------------------------------------------------------
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS user_platform_roles (
            user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            role        platform_role NOT NULL,
            granted_by  UUID REFERENCES auth.users(id),
            granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )

    # -----------------------------------------------------------------
    # 6. organization_members — org-scoped role.
    # -----------------------------------------------------------------
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS organization_members (
            id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            role         org_member_role NOT NULL DEFAULT 'staff',
            invited_by   UUID REFERENCES auth.users(id),
            invited_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            joined_at    TIMESTAMPTZ,
            is_active    BOOLEAN NOT NULL DEFAULT TRUE,
            updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_org_member UNIQUE (org_id, user_id)
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_org_members_user "
        "ON organization_members(user_id) WHERE is_active = TRUE"
    )

    # -----------------------------------------------------------------
    # 7. user_preferences — FK to profiles (requires a profile first).
    # -----------------------------------------------------------------
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS user_preferences (
            user_id        UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
            interest_tags  TEXT[]      NOT NULL DEFAULT '{}',
            preferred_days INTEGER[]   NOT NULL DEFAULT '{}',
            price_cap      DECIMAL(8,2),
            updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )

    # -----------------------------------------------------------------
    # 8. handle_new_user trigger — auto-create profile on sign-up.
    # -----------------------------------------------------------------
    # Fires after every auth.users INSERT. Uses SECURITY DEFINER so it can
    # write to public.profiles regardless of who performed the sign-up.
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
                    COALESCE(NEW.raw_user_meta_data->>'firstName','') || ' ' ||
                    COALESCE(NEW.raw_user_meta_data->>'lastName','')
                ), ''),
                NOW(), NOW(), NOW()
            )
            ON CONFLICT (id) DO NOTHING;
            RETURN NEW;
        END;
        $$;
        """
    )
    op.execute("DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users")
    op.execute(
        """
        CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
        """
    )

    # -----------------------------------------------------------------
    # 9. RLS on profiles (basic policies).
    # -----------------------------------------------------------------
    op.execute("ALTER TABLE profiles ENABLE ROW LEVEL SECURITY")
    op.execute(
        "DROP POLICY IF EXISTS profiles_own ON profiles; "
        "CREATE POLICY profiles_own ON profiles FOR ALL USING (auth.uid() = id)"
    )
    op.execute(
        "DROP POLICY IF EXISTS profiles_public_read ON profiles; "
        "CREATE POLICY profiles_public_read ON profiles FOR SELECT USING (TRUE)"
    )

    op.execute("ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY")
    op.execute(
        "DROP POLICY IF EXISTS prefs_own ON user_preferences; "
        "CREATE POLICY prefs_own ON user_preferences FOR ALL USING (auth.uid() = user_id)"
    )


def downgrade() -> None:
    # Supabase-native migration; irreversible by design.
    # Recreating the legacy auth tables would lose all real identities.
    raise NotImplementedError(
        "004_supabase_auth_profiles is not reversible — "
        "auth now lives in auth.users owned by Supabase."
    )
