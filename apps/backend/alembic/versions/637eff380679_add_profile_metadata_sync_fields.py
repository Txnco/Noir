"""add_profile_metadata_sync_fields

Revision ID: 637eff380679
Revises: 005_profile_split_name
Create Date: 2026-04-22 13:42:47.375421

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '637eff380679'
down_revision: Union[str, None] = '005_profile_split_name'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to profiles with existence checks
    op.execute('ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255)')
    op.execute('ALTER TABLE profiles ADD COLUMN IF NOT EXISTS app_metadata JSONB DEFAULT \'{}\'')
    op.execute('ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_metadata JSONB DEFAULT \'{}\'')
    op.execute('ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ')
    
    # Increase avatar_url size and ensure date_of_birth is timestamp
    op.execute('ALTER TABLE profiles ALTER COLUMN avatar_url TYPE TEXT')
    op.execute('ALTER TABLE profiles ALTER COLUMN date_of_birth TYPE TIMESTAMP')
    
    # Add index for email with existence check
    op.execute('CREATE UNIQUE INDEX IF NOT EXISTS ix_profiles_email ON profiles(email)')


def downgrade() -> None:
    op.execute('DROP INDEX IF EXISTS ix_profiles_email')
    op.execute('ALTER TABLE profiles DROP COLUMN IF EXISTS last_login')
    op.execute('ALTER TABLE profiles DROP COLUMN IF EXISTS user_metadata')
    op.execute('ALTER TABLE profiles DROP COLUMN IF EXISTS app_metadata')
    op.execute('ALTER TABLE profiles DROP COLUMN IF EXISTS email')
