from sqlalchemy import DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class FireDetection(Base):
    __tablename__ = "fire_detections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    brightness: Mapped[float | None] = mapped_column(Float, nullable=True)
    frp: Mapped[float | None] = mapped_column(Float, nullable=True)
    confidence: Mapped[str | None] = mapped_column(String(16), nullable=True)
    acq_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    fetched_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
