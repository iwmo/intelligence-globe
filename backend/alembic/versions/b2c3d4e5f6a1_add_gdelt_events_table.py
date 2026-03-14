"""add_gdelt_events_table

Revision ID: b2c3d4e5f6a1
Revises: a4f7c2e9b1d3
Create Date: 2026-03-14

Creates the gdelt_events table for Phase 34 GDELT Integration.

Key design decisions (baked in from day one — see STATE.md v8.0 Key Decisions):
  - UNIQUE constraint on global_event_id from day one — GDELT files overlap across
    15-minute boundaries; adding UNIQUE CONCURRENTLY after rows exist requires downtime
    if duplicates are present.
  - event_code is VARCHAR(4) not INTEGER — code '040' as integer becomes '40', a
    different CAMEO event type with no recovery path short of full re-ingest.
  - 7-day rolling retention (via application-level cleanup task) — non-partitioned
    table is correct at this retention cap (~100-150k rows max).

Satisfies GDELT-01 schema infrastructure.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a1"
down_revision: Union[str, Sequence[str], None] = "a4f7c2e9b1d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create gdelt_events table with UNIQUE constraint and supporting indexes."""
    op.execute(
        """
        CREATE TABLE gdelt_events (
            id              BIGSERIAL PRIMARY KEY,
            global_event_id VARCHAR(20) NOT NULL,
            occurred_at     TIMESTAMPTZ NOT NULL,
            discovered_at   TIMESTAMPTZ,
            latitude        DOUBLE PRECISION,
            longitude       DOUBLE PRECISION,
            quad_class      INTEGER,
            goldstein_scale DOUBLE PRECISION,
            event_code      VARCHAR(4),
            actor1_name     TEXT,
            actor2_name     TEXT,
            source_url      TEXT,
            avg_tone        DOUBLE PRECISION,
            num_mentions    INTEGER,
            source_is_stale BOOLEAN,
            CONSTRAINT uq_gdelt_events_global_event_id UNIQUE (global_event_id)
        )
        """
    )

    op.execute(
        "CREATE INDEX ix_gdelt_events_occurred_at ON gdelt_events (occurred_at)"
    )

    op.execute(
        "CREATE INDEX ix_gdelt_events_lat_lon ON gdelt_events (latitude, longitude)"
    )


def downgrade() -> None:
    """Drop gdelt_events table (no foreign keys — CASCADE not required)."""
    op.execute("DROP TABLE IF EXISTS gdelt_events")
