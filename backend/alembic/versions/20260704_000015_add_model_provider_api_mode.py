"""add model provider api mode

Revision ID: 20260704_000015
Revises: 20260704_000014
Create Date: 2026-07-04 22:45:00
"""

from alembic import op
import sqlalchemy as sa

revision = "20260704_000015"
down_revision = "20260704_000014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "model_provider_settings",
        sa.Column(
            "api_mode",
            sa.String(length=32),
            nullable=False,
            server_default="chat_completions",
        ),
    )
    op.create_check_constraint(
        "ck_model_provider_settings__api_mode_supported",
        "model_provider_settings",
        "api_mode in ('chat_completions', 'responses')",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_model_provider_settings__api_mode_supported",
        "model_provider_settings",
        type_="check",
    )
    op.drop_column("model_provider_settings", "api_mode")
