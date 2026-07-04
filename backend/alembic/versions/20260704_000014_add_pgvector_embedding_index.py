"""add pgvector embedding index

Revision ID: 20260704_000014
Revises: 20260704_000013
Create Date: 2026-07-05 00:10:00
"""

from alembic import op
import sqlalchemy as sa

revision = "20260704_000014"
down_revision = "20260704_000013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("create extension if not exists vector")
    op.add_column("document_chunks", sa.Column("embedding_vector", sa.Text(), nullable=True))
    op.execute("alter table document_chunks alter column embedding_vector type vector(3072) using embedding_vector::vector")
    op.execute(
        """
        update document_chunks
        set embedding_vector = (
            select ('[' || string_agg(value::text, ',' order by ordinality) || ']')::vector(3072)
            from jsonb_array_elements_text(embedding) with ordinality as item(value, ordinality)
        )
        where embedding_vector is null
          and embedding is not null
          and jsonb_typeof(embedding) = 'array'
          and jsonb_array_length(embedding) = 3072
        """
    )
    op.execute(
        "create index if not exists ix_document_chunks__embedding_vector_hnsw "
        "on document_chunks using hnsw ((embedding_vector::halfvec(3072)) halfvec_cosine_ops) "
        "where embedding_vector is not null"
    )


def downgrade() -> None:
    op.execute("drop index if exists ix_document_chunks__embedding_vector_hnsw")
    op.drop_column("document_chunks", "embedding_vector")
