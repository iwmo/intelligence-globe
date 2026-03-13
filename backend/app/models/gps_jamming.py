"""
GpsJammingCell SQLAlchemy model.

Stores H3-aggregated GPS jamming severity data derived from NIC/NACp
accuracy fields reported by military aircraft via airplanes.live /v2/mil.

h3index is the primary key (H3 resolution-5 cell index string).
bad_ratio uses the formula: max(0.0, (bad_count - 1) / total_count).
severity thresholds: red >= 0.3, yellow >= 0.1, green < 0.1.
"""
from sqlalchemy import Boolean, Float, Integer, String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class GpsJammingCell(Base):
    __tablename__ = "gps_jamming_cells"

    h3index: Mapped[str] = mapped_column(String, primary_key=True)
    bad_ratio: Mapped[float] = mapped_column(Float, nullable=False)
    severity: Mapped[str] = mapped_column(String, nullable=False)
    aircraft_count: Mapped[int] = mapped_column(Integer, nullable=False)

    # Freshness columns (MIG-01)
    aggregated_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_fetched_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_is_stale: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=True,
    )
