"""Wave 3 live layers: earthquakes, fire detections, launches.

Revision ID: h4i5j6k7l8m9
Revises: g3h4i5j6k7l8
Create Date: 2026-08-25
"""
from alembic import op
import sqlalchemy as sa

revision = "h4i5j6k7l8m9"
down_revision = "g3h4i5j6k7l8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "earthquakes",
        sa.Column("usgs_id", sa.String(40), primary_key=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("depth_km", sa.Float(), nullable=True),
        sa.Column("magnitude", sa.Float(), nullable=True),
        sa.Column("place", sa.Text(), nullable=True),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_earthquakes_occurred_at", "earthquakes", ["occurred_at"])
    op.create_index("ix_earthquakes_lat_lon", "earthquakes", ["latitude", "longitude"])

    op.create_table(
        "fire_detections",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("brightness", sa.Float(), nullable=True),
        sa.Column("frp", sa.Float(), nullable=True),
        sa.Column("confidence", sa.String(16), nullable=True),
        sa.Column("acq_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_fire_detections_lat_lon", "fire_detections", ["latitude", "longitude"])

    op.create_table(
        "launches",
        sa.Column("ll2_id", sa.String(64), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("net", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(64), nullable=True),
        sa.Column("pad_name", sa.Text(), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_launches_net", "launches", ["net"])


def downgrade() -> None:
    op.drop_table("launches")
    op.drop_table("fire_detections")
    op.drop_table("earthquakes")
