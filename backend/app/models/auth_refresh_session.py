import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Index, String, func, text
from sqlalchemy.dialects.postgresql import INET, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import RefreshRevokeReason

ENUM_VALUES = lambda enum_cls: [item.value for item in enum_cls]


class AuthRefreshSession(Base):
    __tablename__ = "auth_refresh_sessions"
    __table_args__ = (
        CheckConstraint("expires_at > issued_at", name="expiry_after_issue"),
        CheckConstraint(
            "((revoked_at is not null and revoked_reason is not null) or (revoked_at is null and revoked_reason is null))",
            name="revocation_reason_consistency",
        ),
        CheckConstraint("parent_session_id is null or parent_session_id <> id", name="parent_not_self"),
        CheckConstraint(
            "replaced_by_session_id is null or replaced_by_session_id <> id",
            name="replacement_not_self",
        ),
        Index("ix_auth_refresh_sessions__user_active", "user_id", "expires_at", postgresql_where=text("revoked_at is null")),
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
    family_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    parent_session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth_refresh_sessions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    replaced_by_session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth_refresh_sessions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    refresh_token_hash: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_reason: Mapped[RefreshRevokeReason | None] = mapped_column(
        Enum(
            RefreshRevokeReason,
            name="refresh_revoke_reason",
            values_callable=ENUM_VALUES,
        ),
        nullable=True,
    )
    ip_address: Mapped[str | None] = mapped_column(INET(), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
