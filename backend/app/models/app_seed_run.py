from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, String, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AppSeedRun(Base):
    __tablename__ = "app_seed_runs"
    __table_args__ = (
        CheckConstraint("char_length(btrim(seed_key)) > 0", name="seed_key_not_blank"),
    )

    seed_key: Mapped[str] = mapped_column(String, primary_key=True)
    checksum: Mapped[str | None] = mapped_column(String, nullable=True)
    payload: Mapped[dict[str, object] | None] = mapped_column(JSONB, nullable=True)
    applied_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        server_onupdate=func.now(),
    )
