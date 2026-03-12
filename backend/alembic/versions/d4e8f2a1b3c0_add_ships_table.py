"""add_ships_table

Revision ID: d4e8f2a1b3c0
Revises: c5795b11a549
Create Date: 2026-03-12 00:00:00.000000

Creates the ships table for AIS (Automatic Identification System) data
from aisstream.io. MMSI is the primary key stored as string for safe
JSON serialization. Satisfies LAY-03 backend data infrastructure.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e8f2a1b3c0'
down_revision: Union[str, Sequence[str], None] = 'c5795b11a549'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create ships table for AIS vessel tracking data."""
    op.create_table(
        'ships',
        sa.Column('mmsi', sa.String(), nullable=False),
        sa.Column('vessel_name', sa.String(), nullable=True),
        sa.Column('vessel_type', sa.String(), nullable=True),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('sog', sa.Float(), nullable=True),
        sa.Column('cog', sa.Float(), nullable=True),
        sa.Column('true_heading', sa.Float(), nullable=True),
        sa.Column('nav_status', sa.Integer(), nullable=True),
        sa.Column('last_update', sa.String(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('mmsi'),
    )


def downgrade() -> None:
    """Drop ships table."""
    op.drop_table('ships')
