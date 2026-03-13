"""
Aircraft SQLAlchemy model.

Stores live OpenSky state-vector data with a JSONB trail column for
rendering polylines on the frontend without a second round-trip.

icao24 is the primary key directly (ICAO 24-bit address, hex string).
No surrogate integer id column — aircraft identity is the ICAO24.

Trail stores a list of {lon, lat, alt, ts} dicts, max 20 elements.
Cap enforcement is done by the ingest worker (not the model).
"""
from sqlalchemy import Boolean, Float, Integer, String, DateTime, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Aircraft(Base):
    __tablename__ = "aircraft"

    icao24: Mapped[str] = mapped_column(String, primary_key=True)
    callsign: Mapped[str | None] = mapped_column(String, nullable=True)
    origin_country: Mapped[str | None] = mapped_column(String, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    baro_altitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    on_ground: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    velocity: Mapped[float | None] = mapped_column(Float, nullable=True)
    true_track: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_contact: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Freshness columns (MIG-01)
    time_position: Mapped[int | None] = mapped_column(Integer, nullable=True)
    geo_altitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    vertical_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    position_source: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fetched_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_seen_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default='true')

    # Trail: list of {lon, lat, alt, ts} dicts, newest last, max 20 entries
    trail: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=True,
    )
