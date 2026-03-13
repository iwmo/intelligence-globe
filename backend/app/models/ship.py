"""
Ship SQLAlchemy model.

Stores live AIS (Automatic Identification System) data from aisstream.io.

mmsi is the primary key (Maritime Mobile Service Identity), stored as a
string for safe JSON serialization (MMSI values are 9-digit integers but
treated as opaque identifiers).
"""
from sqlalchemy import Boolean, String, Float, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Ship(Base):
    __tablename__ = "ships"

    mmsi: Mapped[str] = mapped_column(String, primary_key=True)
    vessel_name: Mapped[str | None] = mapped_column(String, nullable=True)
    vessel_type: Mapped[str | None] = mapped_column(String, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    sog: Mapped[float | None] = mapped_column(Float, nullable=True)   # speed over ground, knots
    cog: Mapped[float | None] = mapped_column(Float, nullable=True)   # course over ground, degrees
    true_heading: Mapped[float | None] = mapped_column(Float, nullable=True)
    nav_status: Mapped[int | None] = mapped_column(nullable=True)
    last_update: Mapped[str | None] = mapped_column(String, nullable=True)  # time_utc string

    # Freshness columns (MIG-01)
    last_seen_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default='true')

    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=True
    )
