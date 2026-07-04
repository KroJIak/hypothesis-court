"""ensure research runtime columns

Revision ID: 20260704_000012
Revises: 20260704_000011
Create Date: 2026-07-04 23:40:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260704_000012"
down_revision = "20260704_000011"
branch_labels = None
depends_on = None


def _columns(table_name: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {column["name"] for column in inspector.get_columns(table_name)}


def _add_column_if_missing(table_name: str, column: sa.Column) -> None:
    if column.name not in _columns(table_name):
        op.add_column(table_name, column)


def upgrade() -> None:
    _add_column_if_missing("session_files", sa.Column("storage_deleted_at", sa.DateTime(timezone=True), nullable=True))
    _add_column_if_missing("session_files", sa.Column("storage_delete_error", sa.Text(), nullable=True))

    document_chunk_columns = _columns("document_chunks")
    if "embedding" not in document_chunk_columns:
        op.add_column("document_chunks", sa.Column("embedding", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    if "embedding_model" not in document_chunk_columns:
        op.add_column("document_chunks", sa.Column("embedding_model", sa.String(length=255), nullable=True))
    if "embedding_dimensions" not in document_chunk_columns:
        op.add_column("document_chunks", sa.Column("embedding_dimensions", sa.Integer(), nullable=True))
    if "embedded_at" not in document_chunk_columns:
        op.add_column("document_chunks", sa.Column("embedded_at", sa.DateTime(timezone=True), nullable=True))

    check_constraints = sa.inspect(op.get_bind()).get_check_constraints("document_chunks")
    check_sql = " ".join(str(constraint.get("sqltext") or "") for constraint in check_constraints)
    if "embedding_dimensions" not in check_sql:
        op.create_check_constraint(
            "ck_document_chunks__embedding_dimensions_positive",
            "document_chunks",
            "embedding_dimensions is null or embedding_dimensions > 0",
        )
    if "embedding_model" not in check_sql:
        op.create_check_constraint(
            "ck_document_chunks__embedding_model_max_length",
            "document_chunks",
            "embedding_model is null or char_length(embedding_model) <= 255",
        )


def downgrade() -> None:
    # This migration repairs partially migrated environments. Downgrade must be
    # non-destructive because the same columns are part of 000011 on clean DBs.
    pass
