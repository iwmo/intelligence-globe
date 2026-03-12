"""
PositionSnapshot SQLAlchemy ORM model.

Maps to the position_snapshots partitioned parent table. Used for replay
SELECT queries — reads all positions for a given layer/time window.

The table is range-partitioned by day (ts column). Daily partitions are
created by ensure_partition() in app.tasks.snapshot_positions.

Composite primary key (id, ts) is required for PostgreSQL partitioned
tables — the partition key must be included in the PK.

This model represents the parent table only. No child/partition ORM
models are needed; PostgreSQL routes all DML/queries to the correct
partition transparently.
"""
from sqlalchemy import BigInteger, DateTime, Float, PrimaryKeyConstraint, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class PositionSnapshot(Base):
    __tablename__ = "position_snapshots"

    # BIGSERIAL id — auto-assigned by the partition's sequence
    id: Mapped[int] = mapped_column(BigInteger, autoincrement=True, nullable=False)

    # Partition key — included in PK per PostgreSQL partitioned table requirement
    ts: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False)

    layer_type: Mapped[str] = mapped_column(String, nullable=False)
    entity_id: Mapped[str] = mapped_column(String, nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    altitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    heading: Mapped[float | None] = mapped_column(Float, nullable=True)
    speed: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Composite PK required by PostgreSQL partitioned tables
    __table_args__ = (PrimaryKeyConstraint("id", "ts"),)
