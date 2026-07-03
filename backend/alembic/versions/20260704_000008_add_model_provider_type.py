"""add model provider type

Revision ID: 20260704_000008
Revises: 20260704_000007
Create Date: 2026-07-04 19:00:00
"""

from alembic import op
import sqlalchemy as sa

revision = "20260704_000008"
down_revision = "20260704_000007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "model_provider_settings",
        sa.Column("provider_type", sa.String(length=32), nullable=False, server_default="openai"),
    )
    op.create_check_constraint(
        "ck_model_provider_settings__provider_type_supported",
        "model_provider_settings",
        "provider_type in ('openai', 'yandex_ai_studio')",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_model_provider_settings__provider_type_supported",
        "model_provider_settings",
        type_="check",
    )
    op.drop_column("model_provider_settings", "provider_type")
