"""
OSINT Event SQLAlchemy model.

Stores manually or automatically ingested open-source intelligence events
correlated with globe activity (kinetic, airspace, maritime, seismic, jamming).
"""
from sqlalchemy import Integer, String, Float, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class OsintEvent(Base):
    __tablename__ = "osint_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ts: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    label: Mapped[str] = mapped_column(String, nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    source_url: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
