"""initial identity and auth schema

Revision ID: 20260703_000001
Revises:
Create Date: 2026-07-03 01:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260703_000001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("create extension if not exists citext")
    op.execute("create extension if not exists pgcrypto")

    user_status = sa.Enum("active", "inactive", "deleted", name="user_status")
    refresh_revoke_reason = sa.Enum(
        "logout",
        "logout_all",
        "password_changed",
        "admin_reset",
        "admin_delete",
        "rotation_replaced",
        "reuse_detected",
        name="refresh_revoke_reason",
    )
    audit_event_type = sa.Enum(
        "user_created",
        "user_updated",
        "user_deleted",
        "password_changed",
        "password_reset",
        "login_success",
        "login_failed",
        "logout",
        "logout_all",
        "refresh_rotated",
        "refresh_reuse_detected",
        name="audit_event_type",
    )

    user_status.create(op.get_bind(), checkfirst=True)
    refresh_revoke_reason.create(op.get_bind(), checkfirst=True)
    audit_event_type.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("username", postgresql.CITEXT(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_superadmin", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("first_name", sa.String(length=100), nullable=True),
        sa.Column("last_name", sa.String(length=100), nullable=True),
        sa.Column(
            "status",
            postgresql.ENUM(
                "active",
                "inactive",
                "deleted",
                name="user_status",
                create_type=False,
            ),
            nullable=False,
            server_default="active",
        ),
        sa.Column("token_version", sa.BigInteger(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("deleted_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["deleted_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("username", name="uq_users__username"),
        sa.CheckConstraint("btrim(username::text) = username::text", name="ck_users__username_trimmed"),
        sa.CheckConstraint("char_length(username::text) between 3 and 64", name="ck_users__username_length"),
        sa.CheckConstraint(
            "first_name is null or (btrim(first_name) = first_name and char_length(first_name) > 0)",
            name="ck_users__first_name_trimmed",
        ),
        sa.CheckConstraint(
            "last_name is null or (btrim(last_name) = last_name and char_length(last_name) > 0)",
            name="ck_users__last_name_trimmed",
        ),
        sa.CheckConstraint("token_version >= 1", name="ck_users__token_version_positive"),
        sa.CheckConstraint("(not is_superadmin) or is_admin", name="ck_users__superadmin_implies_admin"),
        sa.CheckConstraint(
            "((status = 'deleted' and deleted_at is not null) or (status <> 'deleted' and deleted_at is null))",
            name="ck_users__deleted_status_consistency",
        ),
        sa.CheckConstraint(
            "((deleted_by_user_id is not null and status = 'deleted') or (deleted_by_user_id is null))",
            name="ck_users__deleted_actor_consistency",
        ),
    )
    op.create_index("ix_users__status", "users", ["status"])
    op.create_index("ix_users__is_admin", "users", ["is_admin"])
    op.create_index("ix_users__created_at", "users", ["created_at"])

    op.create_table(
        "auth_refresh_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("family_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("parent_session_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("replaced_by_session_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("refresh_token_hash", sa.String(), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "revoked_reason",
            postgresql.ENUM(
                "logout",
                "logout_all",
                "password_changed",
                "admin_reset",
                "admin_delete",
                "rotation_replaced",
                "reuse_detected",
                name="refresh_revoke_reason",
                create_type=False,
            ),
            nullable=True,
        ),
        sa.Column("ip_address", postgresql.INET(), nullable=True),
        sa.Column("user_agent", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_session_id"], ["auth_refresh_sessions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["replaced_by_session_id"], ["auth_refresh_sessions.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("refresh_token_hash", name="uq_auth_refresh_sessions__refresh_token_hash"),
        sa.CheckConstraint("expires_at > issued_at", name="ck_auth_refresh_sessions__expiry_after_issue"),
        sa.CheckConstraint(
            "((revoked_at is not null and revoked_reason is not null) or (revoked_at is null and revoked_reason is null))",
            name="ck_auth_refresh_sessions__revocation_reason_consistency",
        ),
        sa.CheckConstraint("parent_session_id is null or parent_session_id <> id", name="ck_auth_refresh_sessions__parent_not_self"),
        sa.CheckConstraint(
            "replaced_by_session_id is null or replaced_by_session_id <> id",
            name="ck_auth_refresh_sessions__replacement_not_self",
        ),
    )
    op.create_index("ix_auth_refresh_sessions__user_id", "auth_refresh_sessions", ["user_id"])
    op.create_index("ix_auth_refresh_sessions__family_id", "auth_refresh_sessions", ["family_id"])
    op.create_index("ix_auth_refresh_sessions__parent_session_id", "auth_refresh_sessions", ["parent_session_id"])
    op.create_index("ix_auth_refresh_sessions__replaced_by_session_id", "auth_refresh_sessions", ["replaced_by_session_id"])
    op.create_index("ix_auth_refresh_sessions__expires_at", "auth_refresh_sessions", ["expires_at"])
    op.create_index(
        "ix_auth_refresh_sessions__user_active",
        "auth_refresh_sessions",
        ["user_id", "expires_at"],
        postgresql_where=sa.text("revoked_at is null"),
    )

    op.create_table(
        "audit_events",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True, nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("target_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "event_type",
            postgresql.ENUM(
                "user_created",
                "user_updated",
                "user_deleted",
                "password_changed",
                "password_reset",
                "login_success",
                "login_failed",
                "logout",
                "logout_all",
                "refresh_rotated",
                "refresh_reuse_detected",
                name="audit_event_type",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["target_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.CheckConstraint("jsonb_typeof(payload) = 'object'", name="ck_audit_events__payload_is_object"),
    )
    op.create_index("ix_audit_events__actor_user_id", "audit_events", ["actor_user_id"])
    op.create_index("ix_audit_events__target_user_id", "audit_events", ["target_user_id"])
    op.create_index("ix_audit_events__event_type", "audit_events", ["event_type"])
    op.create_index("ix_audit_events__created_at", "audit_events", ["created_at"])

    op.create_table(
        "app_seed_runs",
        sa.Column("seed_key", sa.String(), primary_key=True, nullable=False),
        sa.Column("checksum", sa.String(), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("applied_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("char_length(btrim(seed_key)) > 0", name="ck_app_seed_runs__seed_key_not_blank"),
    )


def downgrade() -> None:
    op.drop_table("app_seed_runs")
    op.drop_index("ix_audit_events__created_at", table_name="audit_events")
    op.drop_index("ix_audit_events__event_type", table_name="audit_events")
    op.drop_index("ix_audit_events__target_user_id", table_name="audit_events")
    op.drop_index("ix_audit_events__actor_user_id", table_name="audit_events")
    op.drop_table("audit_events")
    op.drop_index("ix_auth_refresh_sessions__user_active", table_name="auth_refresh_sessions")
    op.drop_index("ix_auth_refresh_sessions__expires_at", table_name="auth_refresh_sessions")
    op.drop_index("ix_auth_refresh_sessions__replaced_by_session_id", table_name="auth_refresh_sessions")
    op.drop_index("ix_auth_refresh_sessions__parent_session_id", table_name="auth_refresh_sessions")
    op.drop_index("ix_auth_refresh_sessions__family_id", table_name="auth_refresh_sessions")
    op.drop_index("ix_auth_refresh_sessions__user_id", table_name="auth_refresh_sessions")
    op.drop_table("auth_refresh_sessions")
    op.drop_index("ix_users__created_at", table_name="users")
    op.drop_index("ix_users__is_admin", table_name="users")
    op.drop_index("ix_users__status", table_name="users")
    op.drop_table("users")

    sa.Enum(name="audit_event_type").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="refresh_revoke_reason").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="user_status").drop(op.get_bind(), checkfirst=True)
