import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import ResearchInputKind
from app.models.user import ENUM_VALUES


class ResearchInputItem(Base):
    __tablename__ = "research_input_items"
    __table_args__ = (
        UniqueConstraint("run_id", "position", name="uq_research_input_items__run_id_position"),
        CheckConstraint("position >= 0", name="position_non_negative"),
        CheckConstraint("btrim(label) = label and char_length(label) between 1 and 64", name="label_trimmed_length"),
        CheckConstraint("btrim(text) = text and char_length(text) between 1 and 4000", name="text_trimmed_length"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("research_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kind: Mapped[ResearchInputKind] = mapped_column(
        Enum(ResearchInputKind, name="research_input_kind", values_callable=ENUM_VALUES),
        nullable=False,
    )
    label: Mapped[str] = mapped_column(String(64), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
