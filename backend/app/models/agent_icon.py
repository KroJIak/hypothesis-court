from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AgentIcon(Base):
    __tablename__ = "agent_icons"
    __table_args__ = (
        CheckConstraint("btrim(icon_key) = icon_key and char_length(icon_key) between 1 and 64", name="icon_key_trimmed_length"),
        CheckConstraint("btrim(label) = label and char_length(label) between 1 and 100", name="label_trimmed_length"),
        CheckConstraint("sort_order >= 0", name="sort_order_non_negative"),
    )

    icon_key: Mapped[str] = mapped_column(String(64), primary_key=True)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
