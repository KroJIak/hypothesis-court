import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ModelProviderSettings(Base):
    __tablename__ = "model_provider_settings"
    __table_args__ = (
        CheckConstraint("char_length(btrim(provider)) > 0", name="provider_not_blank"),
        CheckConstraint("provider_type in ('openai', 'yandex_ai_studio')", name="provider_type_supported"),
        CheckConstraint("api_mode in ('chat_completions', 'responses')", name="api_mode_supported"),
        CheckConstraint("char_length(btrim(base_url)) > 0", name="base_url_not_blank"),
        CheckConstraint(
            "model is null or char_length(btrim(model)) > 0",
            name="model_not_blank",
        ),
        CheckConstraint(
            "project_id is null or char_length(btrim(project_id)) > 0",
            name="project_id_not_blank",
        ),
        CheckConstraint(
            "api_token is null or char_length(btrim(api_token)) > 0",
            name="api_token_not_blank",
        ),
    )

    provider: Mapped[str] = mapped_column(String(32), primary_key=True)
    provider_type: Mapped[str] = mapped_column(String(32), nullable=False, default="openai", server_default="openai")
    api_mode: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="chat_completions",
        server_default="chat_completions",
    )
    base_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    project_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    api_token: Mapped[str | None] = mapped_column(String, nullable=True)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    updated_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
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
