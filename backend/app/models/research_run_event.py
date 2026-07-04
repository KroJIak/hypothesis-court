import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Index, Integer, String, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import ResearchRunStage
from app.models.user import ENUM_VALUES


class ResearchRunEvent(Base):
    __tablename__ = "research_run_events"
    __table_args__ = (
        Index("ix_research_run_events__run_id_sequence", "run_id", "sequence_number"),
        Index("ix_research_run_events__run_id_stage", "run_id", "stage"),
        CheckConstraint("sequence_number >= 1", name="sequence_number_positive"),
        CheckConstraint("progress_percent >= 0 and progress_percent <= 100", name="progress_percent_range"),
        CheckConstraint("btrim(message) = message and char_length(message) between 1 and 500", name="message_trimmed_length"),
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
    stage: Mapped[ResearchRunStage] = mapped_column(
        Enum(ResearchRunStage, name="research_run_stage", values_callable=ENUM_VALUES),
        nullable=False,
    )
    sequence_number: Mapped[int] = mapped_column(Integer, nullable=False)
    progress_percent: Mapped[int] = mapped_column(Integer, nullable=False)
    message: Mapped[str] = mapped_column(String(500), nullable=False)
    event_metadata: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
