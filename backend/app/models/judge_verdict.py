import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class JudgeVerdict(Base):
    __tablename__ = "judge_verdicts"
    __table_args__ = (
        CheckConstraint("btrim(summary) = summary and char_length(summary) between 1 and 4000", name="summary_trimmed_length"),
        CheckConstraint("btrim(recommendation) = recommendation and char_length(recommendation) between 1 and 4000", name="recommendation_trimmed_length"),
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
        unique=True,
        index=True,
    )
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    recommendation: Mapped[str] = mapped_column(Text, nullable=False)
    ranking: Mapped[list[dict[str, object]]] = mapped_column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    next_checks: Mapped[list[str]] = mapped_column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
