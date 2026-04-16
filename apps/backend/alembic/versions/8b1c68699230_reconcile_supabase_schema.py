"""reconcile_supabase_schema

Revision ID: 8b1c68699230
Revises: 003_add_audit_logs
Create Date: 2026-04-16 11:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '8b1c68699230'
down_revision: Union[str, None] = '003_add_audit_logs'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Drop constraints and defaults that might interfere
    op.execute('ALTER TABLE users ALTER COLUMN id DROP DEFAULT')
    op.drop_constraint('user_roles_user_id_fkey', 'user_roles', type_='foreignkey')
    
    # 2. Change user_roles.user_id to UUID
    op.execute('ALTER TABLE user_roles ALTER COLUMN user_id TYPE UUID USING user_id::text::uuid')
    
    # 3. Change users.id to UUID
    op.execute('ALTER TABLE users ALTER COLUMN id TYPE UUID USING id::text::uuid')
    
    # 4. Recreate foreign key on user_roles
    op.create_foreign_key('user_roles_user_id_fkey', 'user_roles', 'users', ['user_id'], ['id'], ondelete='CASCADE')

    # 5. Update audit_logs.actor_id to UUID
    op.execute('ALTER TABLE audit_logs ALTER COLUMN actor_id TYPE UUID USING actor_id::text::uuid')

    # 6. Change roles and permissions to UUID if necessary (but models show them as Integer)
    # Actually, models/role.py and models/permission.py show id = Column(Integer, primary_key=True)
    # So we leave them as Integer for now to match models.
    
    # 7. Add gen_random_uuid() default to users.id if we want auto-generation in DB
    # First ensure pgcrypto is available
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
    op.execute('ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid()')
    
def downgrade() -> None:
    # Reverting UUID to Integer is complex and usually not needed in this phase.
    pass
