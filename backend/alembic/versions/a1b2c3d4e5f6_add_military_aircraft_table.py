"""add_military_aircraft_table

Revision ID: a1b2c3d4e5f6
Revises: c5795b11a549
Create Date: 2026-03-12 00:00:00.000000

Creates the military_aircraft table for LAY-01 backend pipeline.
Stores live military aircraft data from airplanes.live /v2/mil.
Altitude is in FEET as received (not metres).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'c5795b11a549'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create military_aircraft table."""
    op.create_table(
        'military_aircraft',
        sa.Column('hex', sa.String(), nullable=False),
        sa.Column('flight', sa.String(), nullable=True),
        sa.Column('aircraft_type', sa.String(), nullable=True),
        sa.Column('registration', sa.String(), nullable=True),
        sa.Column('alt_baro', sa.Float(), nullable=True),
        sa.Column('gs', sa.Float(), nullable=True),
        sa.Column('track', sa.Float(), nullable=True),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('squawk', sa.String(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('hex'),
    )


def downgrade() -> None:
    """Drop military_aircraft table."""
    op.drop_table('military_aircraft')
