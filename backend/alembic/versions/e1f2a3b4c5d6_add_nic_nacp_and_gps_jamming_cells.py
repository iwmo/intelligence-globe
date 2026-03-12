"""add_nic_nacp_and_gps_jamming_cells

Revision ID: e1f2a3b4c5d6
Revises: d4e8f2a1b3c0
Create Date: 2026-03-12 00:00:00.000000

Extends military_aircraft with NIC/NACp accuracy fields used for GPS jamming
detection. Creates the gps_jamming_cells table that stores H3-aggregated
jamming severity data produced by the ingest_gps_jamming RQ task.
Satisfies LAY-02 backend data infrastructure.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, Sequence[str], None] = 'd4e8f2a1b3c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add nic/nac_p to military_aircraft and create gps_jamming_cells table."""
    # Add NIC and NACp columns to military_aircraft
    op.add_column('military_aircraft', sa.Column('nic', sa.Integer(), nullable=True))
    op.add_column('military_aircraft', sa.Column('nac_p', sa.Integer(), nullable=True))

    # Create gps_jamming_cells table for H3-aggregated jamming data
    op.create_table(
        'gps_jamming_cells',
        sa.Column('h3index', sa.String(), nullable=False),
        sa.Column('bad_ratio', sa.Float(), nullable=False),
        sa.Column('severity', sa.String(), nullable=False),
        sa.Column('aircraft_count', sa.Integer(), nullable=False),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint('h3index'),
    )


def downgrade() -> None:
    """Drop gps_jamming_cells table and nic/nac_p columns from military_aircraft."""
    op.drop_table('gps_jamming_cells')
    op.drop_column('military_aircraft', 'nac_p')
    op.drop_column('military_aircraft', 'nic')
