"""add session files

Revision ID: 20260704_000006
Revises: 20260704_000005
Create Date: 2026-07-04 16:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260704_000006"
down_revision = "20260704_000005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "session_files",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("chat_session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("object_key", sa.String(length=500), nullable=False),
        sa.Column("content_type", sa.String(length=255), nullable=True),
        sa.Column("kind", sa.String(length=32), nullable=True),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["chat_session_id"], ["chat_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.CheckConstraint(
            "btrim(original_filename) = original_filename and char_length(original_filename) between 1 and 255",
            name="ck_session_files__original_filename_trimmed_length",
        ),
        sa.CheckConstraint(
            "char_length(object_key) between 1 and 500",
            name="ck_session_files__object_key_length",
        ),
        sa.CheckConstraint(
            "size_bytes > 0",
            name="ck_session_files__size_bytes_positive",
        ),
        sa.CheckConstraint(
            "kind is null or char_length(kind) between 1 and 32",
            name="ck_session_files__kind_length",
        ),
        sa.UniqueConstraint("object_key", name="uq_session_files__object_key"),
    )
    op.create_index("ix_session_files__chat_session_id", "session_files", ["chat_session_id"])
    op.create_index("ix_session_files__user_id", "session_files", ["user_id"])
    op.create_index(
        "ix_session_files__chat_session_id_created_at",
        "session_files",
        ["chat_session_id", "created_at"],
        postgresql_where=sa.text("deleted_at is null"),
    )
    op.create_index(
        "ix_session_files__user_id_chat_session_id",
        "session_files",
        ["user_id", "chat_session_id"],
        postgresql_where=sa.text("deleted_at is null"),
    )


def downgrade() -> None:
    op.drop_index("ix_session_files__user_id_chat_session_id", table_name="session_files")
    op.drop_index("ix_session_files__chat_session_id_created_at", table_name="session_files")
    op.drop_index("ix_session_files__user_id", table_name="session_files")
    op.drop_index("ix_session_files__chat_session_id", table_name="session_files")
    op.drop_table("session_files")
