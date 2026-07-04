import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class EvaluationResult(Base):
    __tablename__ = "evaluation_results"
    __table_args__ = (
        UniqueConstraint("hypothesis_id", "evaluator_key", name="uq_evaluation_results__hypothesis_id_evaluator_key"),
        CheckConstraint("btrim(evaluator_key) = evaluator_key and char_length(evaluator_key) between 1 and 120", name="evaluator_key_trimmed_length"),
        CheckConstraint("btrim(evaluator_name) = evaluator_name and char_length(evaluator_name) between 1 and 120", name="evaluator_name_trimmed_length"),
        CheckConstraint("score >= 0 and score <= 100", name="score_percent_range"),
        CheckConstraint("btrim(verdict) = verdict and char_length(verdict) between 1 and 2000", name="verdict_trimmed_length"),
        CheckConstraint("rationale is null or char_length(rationale) <= 3000", name="rationale_max_length"),
        CheckConstraint("risk_notes is null or char_length(risk_notes) <= 3000", name="risk_notes_max_length"),
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
    hypothesis_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("hypothesis_candidates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_agent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user_agents.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    evaluator_key: Mapped[str] = mapped_column(String(120), nullable=False)
    evaluator_name: Mapped[str] = mapped_column(String(120), nullable=False)
    score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    verdict: Mapped[str] = mapped_column(Text, nullable=False)
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    risk_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
