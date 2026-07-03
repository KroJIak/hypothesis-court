"""add model provider settings

Revision ID: 20260703_000003
Revises: 20260703_000002
Create Date: 2026-07-03 15:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260703_000003"
down_revision = "20260703_000002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "model_provider_settings",
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("base_url", sa.String(length=2048), nullable=False),
        sa.Column("api_token", sa.String(), nullable=True),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("provider"),
        sa.CheckConstraint("char_length(btrim(provider)) > 0", name="ck_model_provider_settings__provider_not_blank"),
        sa.CheckConstraint("char_length(btrim(base_url)) > 0", name="ck_model_provider_settings__base_url_not_blank"),
        sa.CheckConstraint(
            "api_token is null or char_length(btrim(api_token)) > 0",
            name="ck_model_provider_settings__api_token_not_blank",
        ),
    )


def downgrade() -> None:
    op.drop_table("model_provider_settings")
