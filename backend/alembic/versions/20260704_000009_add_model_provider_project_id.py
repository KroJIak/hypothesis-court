"""add model provider project id

Revision ID: 20260704_000009
Revises: 20260704_000008
Create Date: 2026-07-04 19:30:00
"""

from alembic import op
import sqlalchemy as sa

revision = "20260704_000009"
down_revision = "20260704_000008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "model_provider_settings",
        sa.Column("project_id", sa.String(length=255), nullable=True),
    )
    op.create_check_constraint(
        "ck_model_provider_settings__project_id_not_blank",
        "model_provider_settings",
        "project_id is null or char_length(btrim(project_id)) > 0",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_model_provider_settings__project_id_not_blank",
        "model_provider_settings",
        type_="check",
    )
    op.drop_column("model_provider_settings", "project_id")
