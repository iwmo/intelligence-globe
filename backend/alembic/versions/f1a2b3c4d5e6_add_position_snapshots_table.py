"""add_position_snapshots_table

Revision ID: f1a2b3c4d5e6
Revises: e1f2a3b4c5d6
Create Date: 2026-03-12 00:00:00.000000

Creates the position_snapshots partitioned parent table with PARTITION BY
RANGE (ts). Includes a composite primary key (id, ts), an index on
(ts, layer_type) for fast replay queries, and today's initial daily
partition so the first snapshot task run succeeds immediately.

Satisfies REP-01 data infrastructure for Phase 10.
"""
import datetime
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "e1f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create position_snapshots partitioned parent table and today's initial partition."""
    # Create the partitioned parent table
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS position_snapshots (
            id          BIGSERIAL        NOT NULL,
            ts          TIMESTAMPTZ      NOT NULL,
            layer_type  TEXT             NOT NULL,
            entity_id   TEXT             NOT NULL,
            latitude    DOUBLE PRECISION NOT NULL,
            longitude   DOUBLE PRECISION NOT NULL,
            altitude    DOUBLE PRECISION,
            heading     DOUBLE PRECISION,
            speed       DOUBLE PRECISION,
            PRIMARY KEY (id, ts)
        ) PARTITION BY RANGE (ts)
        """
    )

    # Index on (ts, layer_type) for efficient replay window queries
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_position_snapshots_ts_layer "
        "ON position_snapshots (ts, layer_type)"
    )

    # Create today's initial partition so the first snapshot task run succeeds
    today = datetime.date.today()
    tomorrow = today + datetime.timedelta(days=1)
    partition_name = f"position_snapshots_{today.strftime('%Y_%m_%d')}"
    op.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {partition_name}
        PARTITION OF position_snapshots
        FOR VALUES FROM ('{today} 00:00:00+00') TO ('{tomorrow} 00:00:00+00')
        """
    )


def downgrade() -> None:
    """Drop position_snapshots parent table (CASCADE drops all child partitions)."""
    op.execute("DROP TABLE IF EXISTS position_snapshots CASCADE")
