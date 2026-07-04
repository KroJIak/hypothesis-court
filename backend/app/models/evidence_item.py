import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Index, Integer, Numeric, String, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import EvidenceKind
from app.models.user import ENUM_VALUES


class EvidenceItem(Base):
    __tablename__ = "evidence_items"
    __table_args__ = (
        Index("ix_evidence_items__run_id_kind", "run_id", "kind"),
        CheckConstraint("btrim(title) = title and char_length(title) between 1 and 200", name="title_trimmed_length"),
        CheckConstraint("btrim(summary) = summary and char_length(summary) between 1 and 2000", name="summary_trimmed_length"),
        CheckConstraint("quote is null or char_length(quote) <= 2000", name="quote_max_length"),
        CheckConstraint("confidence >= 0 and confidence <= 1", name="confidence_unit_range"),
        CheckConstraint("relevance_score is null or (relevance_score >= 0 and relevance_score <= 1)", name="relevance_score_unit_range"),
        CheckConstraint("rank is null or rank >= 1", name="rank_positive"),
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
    session_file_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("session_files.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    chunk_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("document_chunks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    kind: Mapped[EvidenceKind] = mapped_column(
        Enum(EvidenceKind, name="evidence_kind", values_callable=ENUM_VALUES),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    quote: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    relevance_score: Mapped[Decimal | None] = mapped_column(Numeric(7, 6), nullable=True)
    rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    item_metadata: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
