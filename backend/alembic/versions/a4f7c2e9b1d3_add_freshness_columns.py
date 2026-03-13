"""add freshness columns

Revision ID: a4f7c2e9b1d3
Revises: 6d1d7631153f
Create Date: 2026-03-13

Adds freshness tracking columns to aircraft, military_aircraft, ships,
and gps_jamming_cells tables as required by v4.0 MIG-01.

All timestamp columns are nullable to avoid NOT NULL violations on
pre-migration rows. is_active uses server_default='true' so existing
rows are treated as active immediately with no backfill UPDATE needed.
position_snapshots partitioned table is not touched.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a4f7c2e9b1d3'
down_revision = '6d1d7631153f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- aircraft ---
    op.add_column('aircraft', sa.Column('time_position', sa.Integer(), nullable=True))
    op.add_column('aircraft', sa.Column('geo_altitude', sa.Float(), nullable=True))
    op.add_column('aircraft', sa.Column('vertical_rate', sa.Float(), nullable=True))
    op.add_column('aircraft', sa.Column('position_source', sa.Integer(), nullable=True))
    op.add_column('aircraft', sa.Column('fetched_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('aircraft', sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        'aircraft',
        sa.Column(
            'is_active',
            sa.Boolean(),
            nullable=False,
            server_default=sa.text('true'),
        ),
    )

    # --- military_aircraft ---
    op.add_column('military_aircraft', sa.Column('fetched_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('military_aircraft', sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        'military_aircraft',
        sa.Column(
            'is_active',
            sa.Boolean(),
            nullable=False,
            server_default=sa.text('true'),
        ),
    )

    # --- ships ---
    op.add_column('ships', sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        'ships',
        sa.Column(
            'is_active',
            sa.Boolean(),
            nullable=False,
            server_default=sa.text('true'),
        ),
    )

    # --- gps_jamming_cells ---
    # source_is_stale is nullable=True — no server_default — pre-existing rows have no provenance
    op.add_column('gps_jamming_cells', sa.Column('aggregated_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('gps_jamming_cells', sa.Column('source_fetched_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('gps_jamming_cells', sa.Column('source_is_stale', sa.Boolean(), nullable=True))


def downgrade() -> None:
    # Reverse order: gps_jamming_cells first, aircraft last
    op.drop_column('gps_jamming_cells', 'source_is_stale')
    op.drop_column('gps_jamming_cells', 'source_fetched_at')
    op.drop_column('gps_jamming_cells', 'aggregated_at')

    op.drop_column('ships', 'is_active')
    op.drop_column('ships', 'last_seen_at')

    op.drop_column('military_aircraft', 'is_active')
    op.drop_column('military_aircraft', 'last_seen_at')
    op.drop_column('military_aircraft', 'fetched_at')

    op.drop_column('aircraft', 'is_active')
    op.drop_column('aircraft', 'last_seen_at')
    op.drop_column('aircraft', 'fetched_at')
    op.drop_column('aircraft', 'position_source')
    op.drop_column('aircraft', 'vertical_rate')
    op.drop_column('aircraft', 'geo_altitude')
    op.drop_column('aircraft', 'time_position')
