"""
GdeltEvent SQLAlchemy ORM model.

Maps to the gdelt_events table created by migration a1b2c3d4e5f6.

Design notes:
  - event_code is String(4) / VARCHAR(4) — CAMEO code '040' must round-trip
    as '040', not integer 40.  Using Integer would silently corrupt the data.
  - global_event_id has a UniqueConstraint matching the migration's
    uq_gdelt_events_global_event_id constraint — ensures ORM-level dedup guard.
  - All fields except id, global_event_id, and occurred_at are nullable=True —
    GDELT rows are incomplete in practice; strict NOT NULL here causes ingest
    failures at scale.
  - source_is_stale follows the freshness pattern established in v4.0 MIG-01
    (same column name and semantics as other models).
"""
from sqlalchemy import BigInteger, Boolean, DateTime, Float, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class GdeltEvent(Base):
    __tablename__ = "gdelt_events"

    id: Mapped[int] = mapped_column(BigInteger, autoincrement=True, primary_key=True)

    # Deduplication anchor — GDELT global event ID (up to 18 digits as string)
    global_event_id: Mapped[str] = mapped_column(String(20), nullable=False)

    # Temporal fields — never conflate (see v8.0 Key Decisions)
    occurred_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    discovered_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Geospatial
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    # CAMEO event classification
    quad_class: Mapped[int | None] = mapped_column(Integer, nullable=True)
    goldstein_scale: Mapped[float | None] = mapped_column(Float, nullable=True)
    event_code: Mapped[str | None] = mapped_column(String(4), nullable=True)  # VARCHAR(4) — not INTEGER

    # Actor names (free-form text from GDELT)
    actor1_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    actor2_name: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Source metadata
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    avg_tone: Mapped[float | None] = mapped_column(Float, nullable=True)
    num_mentions: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Freshness tracking (v4.0 MIG-01 pattern)
    source_is_stale: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    __table_args__ = (
        UniqueConstraint("global_event_id", name="uq_gdelt_events_global_event_id"),
    )
