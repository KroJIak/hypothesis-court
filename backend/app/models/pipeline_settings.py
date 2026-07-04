from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Integer, String, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PipelineSettings(Base):
    __tablename__ = "pipeline_settings"
    __table_args__ = (
        CheckConstraint("settings_key = 'global'", name="settings_key_global"),
        CheckConstraint("default_hypothesis_count between 3 and 5", name="default_hypothesis_count_supported"),
        CheckConstraint("debate_round_limit between 1 and 5", name="debate_round_limit_supported"),
        CheckConstraint("retrieval_limit between 1 and 50", name="retrieval_limit_supported"),
        CheckConstraint("char_length(excluded_directions) <= 4000", name="excluded_directions_max_length"),
        CheckConstraint("char_length(domain_constraints) <= 4000", name="domain_constraints_max_length"),
    )

    settings_key: Mapped[str] = mapped_column(String(32), primary_key=True, server_default=text("'global'"))
    default_hypothesis_count: Mapped[int] = mapped_column(Integer, nullable=False, default=3, server_default="3")
    debate_round_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=2, server_default="2")
    retrieval_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=16, server_default="16")
    evaluator_weights: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    excluded_directions: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    domain_constraints: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
