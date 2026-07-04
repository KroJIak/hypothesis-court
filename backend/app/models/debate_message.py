import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Index, Integer, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import DebateRole
from app.models.user import ENUM_VALUES


class DebateMessage(Base):
    __tablename__ = "debate_messages"
    __table_args__ = (
        Index("ix_debate_messages__hypothesis_id_round_role", "hypothesis_id", "round_number", "role"),
        CheckConstraint("round_number >= 1", name="round_number_positive"),
        CheckConstraint("btrim(content) = content and char_length(content) between 1 and 4000", name="content_trimmed_length"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    hypothesis_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("hypothesis_candidates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("hypothesis_versions.id", ondelete="SET NULL"),
        nullable=True,
    )
    round_number: Mapped[int] = mapped_column(Integer, nullable=False)
    role: Mapped[DebateRole] = mapped_column(
        Enum(DebateRole, name="debate_role", values_callable=ENUM_VALUES),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
