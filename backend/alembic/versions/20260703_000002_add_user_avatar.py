"""add user avatar storage key

Revision ID: 20260703_000002
Revises: 20260703_000001
Create Date: 2026-07-03 14:00:00
"""

from alembic import op
import sqlalchemy as sa

revision = "20260703_000002"
down_revision = "20260703_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_object_key", sa.String(length=255), nullable=True))
    op.create_check_constraint(
        "ck_users__avatar_object_key_not_blank",
        "users",
        "avatar_object_key is null or char_length(btrim(avatar_object_key)) > 0",
    )


def downgrade() -> None:
    op.drop_constraint("ck_users__avatar_object_key_not_blank", "users", type_="check")
    op.drop_column("users", "avatar_object_key")
