import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Index, Integer, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import ResearchFeedbackOutcome, ResearchFeedbackTarget
from app.models.user import ENUM_VALUES


class ResearchFeedback(Base):
    __tablename__ = "research_feedback"
    __table_args__ = (
        Index("ix_research_feedback__run_id_created_at", "run_id", "created_at"),
        Index("ix_research_feedback__target", "target_type", "target_id"),
        CheckConstraint("rating is null or (rating >= 1 and rating <= 5)", name="rating_range"),
        CheckConstraint("comment is null or char_length(comment) <= 4000", name="comment_max_length"),
        CheckConstraint("correction is null or char_length(correction) <= 4000", name="correction_max_length"),
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
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_type: Mapped[ResearchFeedbackTarget] = mapped_column(
        Enum(ResearchFeedbackTarget, name="research_feedback_target", values_callable=ENUM_VALUES),
        nullable=False,
    )
    target_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    outcome: Mapped[ResearchFeedbackOutcome] = mapped_column(
        Enum(ResearchFeedbackOutcome, name="research_feedback_outcome", values_callable=ENUM_VALUES),
        nullable=False,
    )
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    correction: Mapped[str | None] = mapped_column(Text, nullable=True)
    feedback_metadata: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
