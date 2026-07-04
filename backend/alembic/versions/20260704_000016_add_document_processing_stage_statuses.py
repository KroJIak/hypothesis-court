"""add document processing stage statuses

Revision ID: 20260704_000016
Revises: 20260704_000015
Create Date: 2026-07-05 03:00:00
"""

from alembic import op

revision = "20260704_000016"
down_revision = "20260704_000015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("alter type document_processing_status add value if not exists 'parsing'")
    op.execute("alter type document_processing_status add value if not exists 'chunked'")
    op.execute("alter type document_processing_status add value if not exists 'indexed'")


def downgrade() -> None:
    # PostgreSQL cannot remove enum values safely without rebuilding the type.
    pass
