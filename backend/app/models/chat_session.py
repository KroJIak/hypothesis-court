import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ChatSession(Base):
    __tablename__ = "chat_sessions"
    __table_args__ = (
        CheckConstraint(
            "btrim(title) = title and char_length(title) between 1 and 200",
            name="title_trimmed_length",
        ),
        CheckConstraint(
            "((is_pinned and pinned_at is not null) or (not is_pinned and pinned_at is null))",
            name="pinned_at_consistency",
        ),
        CheckConstraint(
            "deleted_at is null or not is_pinned",
            name="deleted_sessions_not_pinned",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    is_pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    pinned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
