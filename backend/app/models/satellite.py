"""
Satellite SQLAlchemy model.

Stores CelesTrak OMM/GP JSON fields for SGP4 propagation and metadata display.
The raw_omm JSONB column preserves the full CelesTrak record for forward
compatibility when new fields are added upstream.
"""
from sqlalchemy import Integer, String, Float, DateTime, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


CONSTELLATION_MAP: dict[str, str] = {
    "STARLINK": "Starlink",
    "ONEWEB": "OneWeb",
    "GPS": "GPS",
    "GLONASS": "GLONASS",
    "GALILEO": "Galileo",
    "BEIDOU": "Beidou",
    "ISS": "ISS",
    "IRIDIUM": "Iridium",
    "GLOBALSTAR": "Globalstar",
}


def derive_constellation(object_name: str) -> str | None:
    """Return a constellation label by matching the object_name prefix."""
    upper = object_name.upper()
    for prefix, name in CONSTELLATION_MAP.items():
        if upper.startswith(prefix):
            return name
    return None


class Satellite(Base):
    __tablename__ = "satellites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    norad_cat_id: Mapped[int] = mapped_column(
        Integer, unique=True, nullable=False, index=True
    )
    object_name: Mapped[str] = mapped_column(String, nullable=False)
    constellation: Mapped[str | None] = mapped_column(String, nullable=True)
    epoch: Mapped[str] = mapped_column(String, nullable=False)

    # SGP4 orbital elements
    mean_motion: Mapped[float] = mapped_column(Float, nullable=False)
    eccentricity: Mapped[float] = mapped_column(Float, nullable=False)
    inclination: Mapped[float] = mapped_column(Float, nullable=False)
    ra_of_asc_node: Mapped[float] = mapped_column(Float, nullable=False)
    arg_of_pericenter: Mapped[float] = mapped_column(Float, nullable=False)
    mean_anomaly: Mapped[float] = mapped_column(Float, nullable=False)
    bstar: Mapped[float] = mapped_column(Float, nullable=False)
    mean_motion_dot: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0
    )
    mean_motion_ddot: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0
    )

    # Full CelesTrak OMM record for forward compatibility
    raw_omm: Mapped[dict] = mapped_column(JSONB, nullable=False)

    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=True,
    )
