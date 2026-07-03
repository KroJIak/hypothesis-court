"""add user chat sessions

Revision ID: 20260704_000004
Revises: 20260703_000003
Create Date: 2026-07-04 10:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260704_000004"
down_revision = "20260703_000003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "chat_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("pinned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.CheckConstraint(
            "btrim(title) = title and char_length(title) between 1 and 200",
            name="ck_chat_sessions__title_trimmed_length",
        ),
        sa.CheckConstraint(
            "((is_pinned and pinned_at is not null) or (not is_pinned and pinned_at is null))",
            name="ck_chat_sessions__pinned_at_consistency",
        ),
        sa.CheckConstraint(
            "deleted_at is null or not is_pinned",
            name="ck_chat_sessions__deleted_sessions_not_pinned",
        ),
    )
    op.create_index("ix_chat_sessions__user_id", "chat_sessions", ["user_id"])
    op.create_index("ix_chat_sessions__deleted_at", "chat_sessions", ["deleted_at"])
    op.create_index("ix_chat_sessions__user_id_is_pinned_pinned_at", "chat_sessions", ["user_id", "is_pinned", "pinned_at"])
    op.create_index("ix_chat_sessions__user_id_updated_at", "chat_sessions", ["user_id", "updated_at"])
    op.execute("create index ix_chat_sessions__user_title_lower on chat_sessions (user_id, lower(title)) where deleted_at is null")


def downgrade() -> None:
    op.execute("drop index if exists ix_chat_sessions__user_title_lower")
    op.drop_index("ix_chat_sessions__user_id_updated_at", table_name="chat_sessions")
    op.drop_index("ix_chat_sessions__user_id_is_pinned_pinned_at", table_name="chat_sessions")
    op.drop_index("ix_chat_sessions__deleted_at", table_name="chat_sessions")
    op.drop_index("ix_chat_sessions__user_id", table_name="chat_sessions")
    op.drop_table("chat_sessions")
