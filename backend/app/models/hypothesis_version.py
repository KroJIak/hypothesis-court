import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Integer, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import DebateRole
from app.models.user import ENUM_VALUES


class HypothesisVersion(Base):
    __tablename__ = "hypothesis_versions"
    __table_args__ = (
        UniqueConstraint("hypothesis_id", "version_number", name="uq_hypothesis_versions__hypothesis_id_version_number"),
        CheckConstraint("version_number >= 1", name="version_number_positive"),
        CheckConstraint("btrim(statement) = statement and char_length(statement) between 1 and 3000", name="statement_trimmed_length"),
        CheckConstraint("change_summary is null or char_length(change_summary) <= 2000", name="change_summary_max_length"),
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
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    statement: Mapped[str] = mapped_column(Text, nullable=False)
    change_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_role: Mapped[DebateRole | None] = mapped_column(
        Enum(DebateRole, name="debate_role", values_callable=ENUM_VALUES),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
