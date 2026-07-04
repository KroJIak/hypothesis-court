import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import ResearchRunStatus, ResearchRunTrigger
from app.models.user import ENUM_VALUES


class ResearchRun(Base):
    __tablename__ = "research_runs"
    __table_args__ = (
        UniqueConstraint("chat_session_id", "version_number", name="uq_research_runs__chat_session_id_version_number"),
        Index("ix_research_runs__chat_session_id_created_at", "chat_session_id", "created_at"),
        Index("ix_research_runs__chat_session_id_status", "chat_session_id", "status"),
        Index(
            "uq_research_runs__one_running_per_chat",
            "chat_session_id",
            unique=True,
            postgresql_where=text("status = 'running'"),
        ),
        CheckConstraint("version_number >= 1", name="version_number_positive"),
        CheckConstraint("hypothesis_count between 3 and 5", name="hypothesis_count_supported"),
        CheckConstraint("btrim(title) = title and char_length(title) between 1 and 200", name="title_trimmed_length"),
        CheckConstraint("input_hash is null or char_length(input_hash) = 64", name="input_hash_sha256"),
        CheckConstraint("error_message is null or char_length(error_message) <= 2000", name="error_message_max_length"),
        CheckConstraint(
            "completed_at is null or started_at is null or completed_at >= started_at",
            name="completed_after_started",
        ),
        CheckConstraint(
            "((status = 'running' and completed_at is null) or (status <> 'running' and completed_at is not null))",
            name="terminal_completed_at_consistency",
        ),
        CheckConstraint("(status <> 'failed' or error_message is not null)", name="failed_error_message_required"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    chat_session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    parent_run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("research_runs.id", ondelete="SET NULL"),
        nullable=True,
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    trigger: Mapped[ResearchRunTrigger] = mapped_column(
        Enum(ResearchRunTrigger, name="research_run_trigger", values_callable=ENUM_VALUES),
        nullable=False,
    )
    status: Mapped[ResearchRunStatus] = mapped_column(
        Enum(ResearchRunStatus, name="research_run_status", values_callable=ENUM_VALUES),
        nullable=False,
        default=ResearchRunStatus.RUNNING,
        server_default=ResearchRunStatus.RUNNING.value,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    input_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    model_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    hypothesis_count: Mapped[int] = mapped_column(Integer, nullable=False, default=3, server_default="3")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
