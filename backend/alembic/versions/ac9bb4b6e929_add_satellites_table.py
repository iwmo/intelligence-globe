"""add_satellites_table

Revision ID: ac9bb4b6e929
Revises:
Create Date: 2026-03-11 16:02:42.844443

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'ac9bb4b6e929'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create satellites table and norad_cat_id index."""
    op.create_table(
        'satellites',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('norad_cat_id', sa.Integer(), nullable=False),
        sa.Column('object_name', sa.String(), nullable=False),
        sa.Column('constellation', sa.String(), nullable=True),
        sa.Column('epoch', sa.String(), nullable=False),
        sa.Column('mean_motion', sa.Float(), nullable=False),
        sa.Column('eccentricity', sa.Float(), nullable=False),
        sa.Column('inclination', sa.Float(), nullable=False),
        sa.Column('ra_of_asc_node', sa.Float(), nullable=False),
        sa.Column('arg_of_pericenter', sa.Float(), nullable=False),
        sa.Column('mean_anomaly', sa.Float(), nullable=False),
        sa.Column('bstar', sa.Float(), nullable=False),
        sa.Column('mean_motion_dot', sa.Float(), nullable=False),
        sa.Column('mean_motion_ddot', sa.Float(), nullable=False),
        sa.Column(
            'raw_omm',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('norad_cat_id'),
    )
    op.create_index(
        op.f('ix_satellites_norad_cat_id'),
        'satellites',
        ['norad_cat_id'],
        unique=False,
    )


def downgrade() -> None:
    """Drop satellites table and index."""
    op.drop_index(op.f('ix_satellites_norad_cat_id'), table_name='satellites')
    op.drop_table('satellites')
