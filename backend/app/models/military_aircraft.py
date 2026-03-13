"""
MilitaryAircraft SQLAlchemy model.

Stores live military aircraft data from airplanes.live /v2/mil.
Field names match the airplanes.live JSON schema directly.

hex is the primary key (ICAO 24-bit address, hex string).
No trail column — military layer has no trail requirement in Phase 8.

Altitude is stored in FEET as received from airplanes.live
(unlike OpenSky which uses metres).
"""
from sqlalchemy import Boolean, Float, Integer, String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class MilitaryAircraft(Base):
    __tablename__ = "military_aircraft"

    hex: Mapped[str] = mapped_column(String, primary_key=True)
    flight: Mapped[str | None] = mapped_column(String, nullable=True)
    aircraft_type: Mapped[str | None] = mapped_column(String, nullable=True)
    registration: Mapped[str | None] = mapped_column(String, nullable=True)
    alt_baro: Mapped[float | None] = mapped_column(Float, nullable=True)
    gs: Mapped[float | None] = mapped_column(Float, nullable=True)
    track: Mapped[float | None] = mapped_column(Float, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    squawk: Mapped[str | None] = mapped_column(String, nullable=True)
    nic: Mapped[int | None] = mapped_column(Integer, nullable=True)
    nac_p: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Freshness columns (MIG-01)
    fetched_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_seen_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default='true')

    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=True,
    )
