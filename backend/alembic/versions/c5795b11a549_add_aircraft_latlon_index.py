"""add_aircraft_latlon_index

Revision ID: c5795b11a549
Revises: ca281e8bedd2
Create Date: 2026-03-11 20:22:05.776269

Adds a partial B-tree index on (latitude, longitude) WHERE NOT NULL.
Satisfies INFRA-03 sub-100ms spatial query latency requirement.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c5795b11a549'
down_revision: Union[str, Sequence[str], None] = 'ca281e8bedd2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create partial B-tree index on aircraft (latitude, longitude) WHERE NOT NULL."""
    op.create_index(
        "idx_aircraft_latlon_not_null",
        "aircraft",
        ["latitude", "longitude"],
        postgresql_where="latitude IS NOT NULL AND longitude IS NOT NULL",
    )


def downgrade() -> None:
    """Drop partial B-tree index on aircraft (latitude, longitude)."""
    op.drop_index("idx_aircraft_latlon_not_null", table_name="aircraft")
