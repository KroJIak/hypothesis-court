import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class HypothesisCandidate(Base):
    __tablename__ = "hypothesis_candidates"
    __table_args__ = (
        UniqueConstraint("run_id", "position", name="uq_hypothesis_candidates__run_id_position"),
        Index("ix_hypothesis_candidates__run_id_position", "run_id", "position"),
        CheckConstraint("position >= 0", name="position_non_negative"),
        CheckConstraint("btrim(title) = title and char_length(title) between 1 and 120", name="title_trimmed_length"),
        CheckConstraint("btrim(statement) = statement and char_length(statement) between 1 and 3000", name="statement_trimmed_length"),
        CheckConstraint("char_length(mechanism) <= 3000", name="mechanism_max_length"),
        CheckConstraint("char_length(kpi_alignment) <= 2000", name="kpi_alignment_max_length"),
        CheckConstraint("char_length(feasibility) <= 2000", name="feasibility_max_length"),
        CheckConstraint("char_length(risk_profile) <= 2000", name="risk_profile_max_length"),
        CheckConstraint("char_length(novelty) <= 2000", name="novelty_max_length"),
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
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    statement: Mapped[str] = mapped_column(Text, nullable=False)
    mechanism: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    kpi_alignment: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    feasibility: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    risk_profile: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    novelty: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
