"""merge migration heads

Revision ID: dad9d4f6c61b
Revises: 2f3a4b5c6d7e, 3c4d5e6f7a8b, 9a8b7c6d5e4f
Create Date: 2026-05-16 09:30:30.813161

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dad9d4f6c61b'
down_revision: Union[str, Sequence[str], None] = ('2f3a4b5c6d7e', '3c4d5e6f7a8b', '9a8b7c6d5e4f')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
