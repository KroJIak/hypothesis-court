"""add model provider model

Revision ID: 20260704_000007
Revises: 20260704_000006
Create Date: 2026-07-04 18:00:00
"""

from alembic import op
import sqlalchemy as sa

revision = "20260704_000007"
down_revision = "20260704_000006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "model_provider_settings",
        sa.Column("model", sa.String(length=255), nullable=True),
    )
    op.create_check_constraint(
        "ck_model_provider_settings__model_not_blank",
        "model_provider_settings",
        "model is null or char_length(btrim(model)) > 0",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_model_provider_settings__model_not_blank",
        "model_provider_settings",
        type_="check",
    )
    op.drop_column("model_provider_settings", "model")
