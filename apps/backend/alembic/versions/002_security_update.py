"""Update user model with security fields

Revision ID: 002_security_update
Revises: 001_initial
Create Date: 2026-01-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '002_security_update'
down_revision: Union[str, None] = '001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Updates user table for security improvements:
    - Rename token columns to hash columns
    - Add failed login tracking
    - Add account lockout
    """
    # Add new columns
    with op.batch_alter_table('users', schema=None) as batch_op:
        # Add new hash columns
        batch_op.add_column(sa.Column('password_reset_token_hash', sa.String(255), nullable=True))
        batch_op.add_column(sa.Column('email_verification_token_hash', sa.String(255), nullable=True))
        batch_op.add_column(sa.Column('refresh_token_hash', sa.String(255), nullable=True))
        
        # Add security tracking columns
        batch_op.add_column(sa.Column('failed_login_attempts', sa.Integer(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True))
        
        # Create indexes for hash columns
        batch_op.create_index('ix_users_password_reset_token_hash', ['password_reset_token_hash'])
        batch_op.create_index('ix_users_email_verification_token_hash', ['email_verification_token_hash'])
    
    # Drop old columns (if they exist) - wrapped in try/except for safety
    try:
        with op.batch_alter_table('users', schema=None) as batch_op:
            batch_op.drop_index('ix_users_password_reset_token')
            batch_op.drop_column('password_reset_token')
    except Exception:
        pass
    
    try:
        with op.batch_alter_table('users', schema=None) as batch_op:
            batch_op.drop_index('ix_users_email_verification_token')
            batch_op.drop_column('email_verification_token')
    except Exception:
        pass
    
    try:
        with op.batch_alter_table('users', schema=None) as batch_op:
            batch_op.drop_column('refresh_token')
    except Exception:
        pass


def downgrade() -> None:
    """Revert to old column names."""
    with op.batch_alter_table('users', schema=None) as batch_op:
        # Restore old columns
        batch_op.add_column(sa.Column('password_reset_token', sa.String(255), nullable=True))
        batch_op.add_column(sa.Column('email_verification_token', sa.String(255), nullable=True))
        batch_op.add_column(sa.Column('refresh_token', sa.String(512), nullable=True))
        
        # Create old indexes
        batch_op.create_index('ix_users_password_reset_token', ['password_reset_token'])
        batch_op.create_index('ix_users_email_verification_token', ['email_verification_token'])
        
        # Drop new columns
        batch_op.drop_index('ix_users_password_reset_token_hash')
        batch_op.drop_index('ix_users_email_verification_token_hash')
        batch_op.drop_column('password_reset_token_hash')
        batch_op.drop_column('email_verification_token_hash')
        batch_op.drop_column('refresh_token_hash')
        batch_op.drop_column('failed_login_attempts')
        batch_op.drop_column('locked_until')
