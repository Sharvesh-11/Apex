"""remove per-member qr fields

Revision ID: 9a8b7c6d5e4f
Revises: ecdc083a4f99
Create Date: 2026-05-16 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '9a8b7c6d5e4f'
down_revision = 'ecdc083a4f99'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the per-member QR column if it exists
    with op.batch_alter_table('members') as batch_op:
        batch_op.drop_column('qr_code')


def downgrade() -> None:
    # Add the column back on downgrade
    with op.batch_alter_table('members') as batch_op:
        batch_op.add_column(sa.Column('qr_code', sa.String(), nullable=True))
