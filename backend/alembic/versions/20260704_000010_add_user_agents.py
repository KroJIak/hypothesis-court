"""add user agents

Revision ID: 20260704_000010
Revises: 20260704_000009
Create Date: 2026-07-04 21:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260704_000010"
down_revision = "20260704_000009"
branch_labels = None
depends_on = None

AGENT_ICONS = [
    ("attacker", "Атакующий", 10),
    ("defender", "Защитник", 20),
    ("ecology", "Экология", 30),
    ("finance", "Финансы", 40),
    ("manufacturer", "Производство", 50),
    ("patent", "Патенты", 60),
    ("risk", "Риски", 70),
    ("safety", "Безопасность", 80),
    ("scaling", "Масштабирование", 90),
    ("research", "Исследования", 100),
    ("quality", "Качество", 110),
    ("legal", "Право", 120),
    ("engineering", "Инжиниринг", 130),
    ("data", "Данные", 140),
    ("strategy", "Стратегия", 150),
    ("operations", "Операции", 160),
    ("innovation", "Идеи", 170),
    ("systems", "Системы", 180),
    ("materials", "Материалы", 190),
    ("diagnostics", "Диагностика", 200),
    ("validation", "Валидация", 210),
]


def upgrade() -> None:
    op.create_table(
        "agent_icons",
        sa.Column("icon_key", sa.String(length=64), primary_key=True, nullable=False),
        sa.Column("label", sa.String(length=100), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "btrim(icon_key) = icon_key and char_length(icon_key) between 1 and 64",
            name="ck_agent_icons__icon_key_trimmed_length",
        ),
        sa.CheckConstraint(
            "btrim(label) = label and char_length(label) between 1 and 100",
            name="ck_agent_icons__label_trimmed_length",
        ),
        sa.CheckConstraint("sort_order >= 0", name="ck_agent_icons__sort_order_non_negative"),
    )
    op.create_index("ix_agent_icons__sort_order", "agent_icons", ["sort_order"])
    op.bulk_insert(
        sa.table(
            "agent_icons",
            sa.column("icon_key", sa.String),
            sa.column("label", sa.String),
            sa.column("sort_order", sa.Integer),
        ),
        [
            {"icon_key": icon_key, "label": label, "sort_order": sort_order}
            for icon_key, label, sort_order in AGENT_ICONS
        ],
    )

    op.create_table(
        "user_agents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("icon_key", sa.String(length=64), nullable=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("system_prompt", sa.Text(), nullable=False),
        sa.Column("default_key", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["icon_key"], ["agent_icons.icon_key"], ondelete="SET NULL"),
        sa.CheckConstraint(
            "btrim(name) = name and char_length(name) between 1 and 100",
            name="ck_user_agents__name_trimmed_length",
        ),
        sa.CheckConstraint("char_length(system_prompt) <= 8000", name="ck_user_agents__system_prompt_max_length"),
        sa.CheckConstraint(
            "default_key is null or (btrim(default_key) = default_key and char_length(default_key) between 1 and 64)",
            name="ck_user_agents__default_key_trimmed_length",
        ),
    )
    op.create_index("ix_user_agents__user_id", "user_agents", ["user_id"])
    op.create_index(
        "ix_user_agents__user_id_created_at",
        "user_agents",
        ["user_id", "created_at"],
        postgresql_where=sa.text("deleted_at is null"),
    )
    op.create_index(
        "ix_user_agents__user_id_default_key",
        "user_agents",
        ["user_id", "default_key"],
        unique=True,
        postgresql_where=sa.text("deleted_at is null and default_key is not null"),
    )

    op.create_table(
        "chat_session_agents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("chat_session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("agent_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("placement", sa.String(length=16), nullable=False, server_default="right"),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["chat_session_id"], ["chat_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["agent_id"], ["user_agents.id"], ondelete="CASCADE"),
        sa.CheckConstraint("placement in ('left', 'right')", name="ck_chat_session_agents__placement_supported"),
        sa.CheckConstraint("position >= 0", name="ck_chat_session_agents__position_non_negative"),
        sa.UniqueConstraint("chat_session_id", "agent_id", name="uq_chat_session_agents__chat_session_id_agent_id"),
    )
    op.create_index("ix_chat_session_agents__chat_session_id", "chat_session_agents", ["chat_session_id"])
    op.create_index("ix_chat_session_agents__user_id", "chat_session_agents", ["user_id"])
    op.create_index("ix_chat_session_agents__agent_id", "chat_session_agents", ["agent_id"])
    op.create_index(
        "ix_chat_session_agents__chat_session_id_position",
        "chat_session_agents",
        ["chat_session_id", "position"],
    )


def downgrade() -> None:
    op.drop_index("ix_chat_session_agents__chat_session_id_position", table_name="chat_session_agents")
    op.drop_index("ix_chat_session_agents__agent_id", table_name="chat_session_agents")
    op.drop_index("ix_chat_session_agents__user_id", table_name="chat_session_agents")
    op.drop_index("ix_chat_session_agents__chat_session_id", table_name="chat_session_agents")
    op.drop_table("chat_session_agents")
    op.drop_index("ix_user_agents__user_id_default_key", table_name="user_agents")
    op.drop_index("ix_user_agents__user_id_created_at", table_name="user_agents")
    op.drop_index("ix_user_agents__user_id", table_name="user_agents")
    op.drop_table("user_agents")
    op.drop_index("ix_agent_icons__sort_order", table_name="agent_icons")
    op.drop_table("agent_icons")
