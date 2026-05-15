"""Ensure 'user' is a member of the platform_role enum.

Revision ID: 007_default_user_platform_role
Revises: 006_onboarding_and_tags
Create Date: 2026-05-15

Migration 004 created the platform_role enum *only if it didn't already
exist* (DO $$ ... EXCEPTION WHEN duplicate_object $$). On databases where
the enum was pre-existing with a narrower value set, 'user' may be
missing — which would break the trigger and backfill from migration 008.

This migration is split off so it commits the ALTER TYPE before 008
references the new value. Postgres rejects a freshly-added enum value
if it's referenced in the same transaction that added it.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "007_default_user_platform_role"
down_revision: Union[str, None] = "006_onboarding_and_tags"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotent: ADD VALUE IF NOT EXISTS is a no-op when 'user' is already there.
    op.execute("ALTER TYPE platform_role ADD VALUE IF NOT EXISTS 'user'")


def downgrade() -> None:
    # Postgres has no DROP VALUE for enums — and 008's downgrade will have
    # already removed rows that used this value. Intentional no-op.
    pass
