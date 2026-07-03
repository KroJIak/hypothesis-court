import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, CheckConstraint, DateTime, Enum, ForeignKey, String, func, text
from sqlalchemy.dialects.postgresql import CITEXT, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import UserStatus

ENUM_VALUES = lambda enum_cls: [item.value for item in enum_cls]


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("btrim(username::text) = username::text", name="username_trimmed"),
        CheckConstraint("char_length(username::text) between 3 and 64", name="username_length"),
        CheckConstraint(
            "first_name is null or (btrim(first_name) = first_name and char_length(first_name) > 0)",
            name="first_name_trimmed",
        ),
        CheckConstraint(
            "last_name is null or (btrim(last_name) = last_name and char_length(last_name) > 0)",
            name="last_name_trimmed",
        ),
        CheckConstraint("token_version >= 1", name="token_version_positive"),
        CheckConstraint("(not is_superadmin) or is_admin", name="superadmin_implies_admin"),
        CheckConstraint(
            "((status = 'deleted' and deleted_at is not null) or (status <> 'deleted' and deleted_at is null))",
            name="deleted_status_consistency",
        ),
        CheckConstraint(
            "((deleted_by_user_id is not null and status = 'deleted') or (deleted_by_user_id is null))",
            name="deleted_actor_consistency",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    username: Mapped[str] = mapped_column(CITEXT(), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    is_superadmin: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus, name="user_status", values_callable=ENUM_VALUES),
        nullable=False,
        default=UserStatus.ACTIVE,
        server_default=UserStatus.ACTIVE.value,
    )
    token_version: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=1,
        server_default=text("1"),
    )
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    deleted_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
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
