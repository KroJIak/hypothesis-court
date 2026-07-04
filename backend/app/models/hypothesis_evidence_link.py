import uuid

from sqlalchemy import CheckConstraint, Enum, ForeignKey, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import EvidenceRelationKind
from app.models.user import ENUM_VALUES


class HypothesisEvidenceLink(Base):
    __tablename__ = "hypothesis_evidence_links"
    __table_args__ = (
        UniqueConstraint("hypothesis_id", "evidence_id", "relation", name="uq_hypothesis_evidence_links__hypothesis_evidence_relation"),
        CheckConstraint("rationale is null or char_length(rationale) <= 1000", name="rationale_max_length"),
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
    evidence_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("evidence_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    relation: Mapped[EvidenceRelationKind] = mapped_column(
        Enum(EvidenceRelationKind, name="evidence_relation_kind", values_callable=ENUM_VALUES),
        nullable=False,
    )
    rationale: Mapped[str | None] = mapped_column(String(1000), nullable=True)
