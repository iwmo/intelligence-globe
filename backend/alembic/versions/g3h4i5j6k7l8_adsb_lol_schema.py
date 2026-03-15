"""
Phase 38 ADSB.lol migration — adds telemetry columns. Hand-written per project rule
(position_snapshots is range-partitioned — never autogenerate).

Adds ADSB.lol-specific telemetry fields to the aircraft and military_aircraft tables.

Revision ID: g3h4i5j6k7l8
Revises: b2c3d4e5f6a1
Create Date: 2026-03-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'g3h4i5j6k7l8'
down_revision = 'b2c3d4e5f6a1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- aircraft table ---
    op.add_column('aircraft', sa.Column('emergency', sa.String(), nullable=True))
    op.add_column('aircraft', sa.Column('nav_modes', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('aircraft', sa.Column('ias', sa.Float(), nullable=True))
    op.add_column('aircraft', sa.Column('tas', sa.Float(), nullable=True))
    op.add_column('aircraft', sa.Column('mach', sa.Float(), nullable=True))
    op.add_column('aircraft', sa.Column('roll', sa.Float(), nullable=True))
    op.add_column('aircraft', sa.Column('registration', sa.String(), nullable=True))
    op.add_column('aircraft', sa.Column('type_code', sa.String(), nullable=True))

    # --- military_aircraft table ---
    # NOTE: registration and aircraft_type already exist in military_aircraft — do not re-add
    op.add_column('military_aircraft', sa.Column('emergency', sa.String(), nullable=True))
    op.add_column('military_aircraft', sa.Column('nav_modes', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('military_aircraft', sa.Column('ias', sa.Float(), nullable=True))
    op.add_column('military_aircraft', sa.Column('tas', sa.Float(), nullable=True))
    op.add_column('military_aircraft', sa.Column('mach', sa.Float(), nullable=True))
    op.add_column('military_aircraft', sa.Column('roll', sa.Float(), nullable=True))


def downgrade() -> None:
    # --- military_aircraft table (reverse order) ---
    op.drop_column('military_aircraft', 'roll')
    op.drop_column('military_aircraft', 'mach')
    op.drop_column('military_aircraft', 'tas')
    op.drop_column('military_aircraft', 'ias')
    op.drop_column('military_aircraft', 'nav_modes')
    op.drop_column('military_aircraft', 'emergency')

    # --- aircraft table (reverse order) ---
    op.drop_column('aircraft', 'type_code')
    op.drop_column('aircraft', 'registration')
    op.drop_column('aircraft', 'roll')
    op.drop_column('aircraft', 'mach')
    op.drop_column('aircraft', 'tas')
    op.drop_column('aircraft', 'ias')
    op.drop_column('aircraft', 'nav_modes')
    op.drop_column('aircraft', 'emergency')
