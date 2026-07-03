"""add chat session started state

Revision ID: 20260704_000005
Revises: 20260704_000004
Create Date: 2026-07-04 11:00:00
"""

from alembic import op
import sqlalchemy as sa

revision = "20260704_000005"
down_revision = "20260704_000004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "chat_sessions",
        sa.Column("is_started", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.alter_column("chat_sessions", "is_started", server_default=sa.text("false"))
    op.create_index(
        "ix_chat_sessions__user_id_is_started",
        "chat_sessions",
        ["user_id", "is_started"],
        postgresql_where=sa.text("deleted_at is null"),
    )


def downgrade() -> None:
    op.drop_index("ix_chat_sessions__user_id_is_started", table_name="chat_sessions")
    op.drop_column("chat_sessions", "is_started")
