"""add_pending_to_subscription_status

Revision ID: 3c4d5e6f7a8b
Revises: ecdc083a4f99
Create Date: 2026-05-14 12:30:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '3c4d5e6f7a8b'
down_revision = 'ecdc083a4f99'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add 'pending' to the subscription_status enum if it doesn't already exist.
    Uses the IF NOT EXISTS clause so the migration is safe to run multiple times
    on PostgreSQL versions that support it.
    """
    op.execute("ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'pending';")


def downgrade() -> None:
    # Removing enum values in PostgreSQL is not supported and therefore this
    # migration is not reversible. If you need to remove the value, you must
    # create a new enum type, migrate all columns, drop the old type, and
    # recreate types/constraints accordingly.
    pass
