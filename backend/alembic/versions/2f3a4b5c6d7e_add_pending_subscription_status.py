"""add pending to subscription_status

Revision ID: 2f3a4b5c6d7e
Revises: ecdc083a4f99
Create Date: 2026-05-14 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '2f3a4b5c6d7e'
down_revision = 'ecdc083a4f99'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add the 'pending' label to the subscription_status enum if it doesn't exist.
    Use a conditional DO block to avoid errors when the value already exists.
    """
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_type t
                JOIN pg_enum e ON t.oid = e.enumtypid
                WHERE t.typname = 'subscription_status' AND e.enumlabel = 'pending'
            ) THEN
                ALTER TYPE subscription_status ADD VALUE 'pending';
            END IF;
        END$$;
        """
    )


def downgrade() -> None:
    """Downgrade is not reversible: removing enum labels requires careful migration.
    This downgrade is a no-op.
    """
    pass
