"""add pipeline events feedback settings

Revision ID: 20260704_000013
Revises: 20260704_000012
Create Date: 2026-07-04 23:55:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260704_000013"
down_revision = "20260704_000012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    research_run_stage = sa.Enum(
        "queued",
        "ingestion",
        "retrieval",
        "evidence",
        "hypothesis_generation",
        "debate",
        "evaluation",
        "judge",
        "completed",
        "failed",
        "cancelled",
        name="research_run_stage",
    )
    feedback_target = sa.Enum("run", "hypothesis", "verdict", name="research_feedback_target")
    feedback_outcome = sa.Enum(
        "confirmed",
        "rejected",
        "needs_more_data",
        "unknown",
        name="research_feedback_outcome",
    )
    for enum_type in (research_run_stage, feedback_target, feedback_outcome):
        enum_type.create(op.get_bind(), checkfirst=True)

    op.add_column("document_chunks", sa.Column("source_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")))
    op.add_column("evidence_items", sa.Column("relevance_score", sa.Numeric(7, 6), nullable=True))
    op.add_column("evidence_items", sa.Column("rank", sa.Integer(), nullable=True))
    op.create_index(
        "uq_research_runs__one_running_per_chat",
        "research_runs",
        ["chat_session_id"],
        unique=True,
        postgresql_where=sa.text("status = 'running'"),
    )
    op.create_check_constraint(
        "ck_research_runs__terminal_completed_at_consistency",
        "research_runs",
        "((status = 'running' and completed_at is null) or (status <> 'running' and completed_at is not null))",
    )
    op.create_check_constraint(
        "ck_research_runs__failed_error_message_required",
        "research_runs",
        "(status <> 'failed' or error_message is not null)",
    )
    op.create_check_constraint(
        "ck_evidence_items__relevance_score_unit_range",
        "evidence_items",
        "relevance_score is null or (relevance_score >= 0 and relevance_score <= 1)",
    )
    op.create_check_constraint("ck_evidence_items__rank_positive", "evidence_items", "rank is null or rank >= 1")

    op.create_table(
        "pipeline_settings",
        sa.Column("settings_key", sa.String(length=32), nullable=False, server_default=sa.text("'global'")),
        sa.Column("default_hypothesis_count", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("debate_round_limit", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("retrieval_limit", sa.Integer(), nullable=False, server_default="16"),
        sa.Column("evaluator_weights", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("excluded_directions", sa.Text(), nullable=False, server_default=""),
        sa.Column("domain_constraints", sa.Text(), nullable=False, server_default=""),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("settings_key"),
        sa.CheckConstraint("settings_key = 'global'", name="ck_pipeline_settings__settings_key_global"),
        sa.CheckConstraint("default_hypothesis_count between 3 and 5", name="ck_pipeline_settings__default_hypothesis_count_supported"),
        sa.CheckConstraint("debate_round_limit between 1 and 5", name="ck_pipeline_settings__debate_round_limit_supported"),
        sa.CheckConstraint("retrieval_limit between 1 and 50", name="ck_pipeline_settings__retrieval_limit_supported"),
        sa.CheckConstraint("char_length(excluded_directions) <= 4000", name="ck_pipeline_settings__excluded_directions_max_length"),
        sa.CheckConstraint("char_length(domain_constraints) <= 4000", name="ck_pipeline_settings__domain_constraints_max_length"),
    )
    op.execute(
        "insert into pipeline_settings (settings_key, default_hypothesis_count, debate_round_limit, retrieval_limit) "
        "values ('global', 3, 2, 16) on conflict (settings_key) do nothing"
    )

    op.create_table(
        "research_run_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "stage",
            postgresql.ENUM(
                "queued",
                "ingestion",
                "retrieval",
                "evidence",
                "hypothesis_generation",
                "debate",
                "evaluation",
                "judge",
                "completed",
                "failed",
                "cancelled",
                name="research_run_stage",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("sequence_number", sa.Integer(), nullable=False),
        sa.Column("progress_percent", sa.Integer(), nullable=False),
        sa.Column("message", sa.String(length=500), nullable=False),
        sa.Column("event_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["run_id"], ["research_runs.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("run_id", "sequence_number", name="uq_research_run_events__run_id_sequence_number"),
        sa.CheckConstraint("sequence_number >= 1", name="ck_research_run_events__sequence_number_positive"),
        sa.CheckConstraint("progress_percent >= 0 and progress_percent <= 100", name="ck_research_run_events__progress_percent_range"),
        sa.CheckConstraint("btrim(message) = message and char_length(message) between 1 and 500", name="ck_research_run_events__message_trimmed_length"),
    )
    op.create_index("ix_research_run_events__run_id", "research_run_events", ["run_id"])
    op.create_index("ix_research_run_events__run_id_sequence", "research_run_events", ["run_id", "sequence_number"])
    op.create_index("ix_research_run_events__run_id_stage", "research_run_events", ["run_id", "stage"])

    op.create_table(
        "research_feedback",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_type", postgresql.ENUM("run", "hypothesis", "verdict", name="research_feedback_target", create_type=False), nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("outcome", postgresql.ENUM("confirmed", "rejected", "needs_more_data", "unknown", name="research_feedback_outcome", create_type=False), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("correction", sa.Text(), nullable=True),
        sa.Column("feedback_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["run_id"], ["research_runs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.CheckConstraint("rating is null or (rating >= 1 and rating <= 5)", name="ck_research_feedback__rating_range"),
        sa.CheckConstraint("comment is null or char_length(comment) <= 4000", name="ck_research_feedback__comment_max_length"),
        sa.CheckConstraint("correction is null or char_length(correction) <= 4000", name="ck_research_feedback__correction_max_length"),
    )
    op.create_index("ix_research_feedback__run_id", "research_feedback", ["run_id"])
    op.create_index("ix_research_feedback__user_id", "research_feedback", ["user_id"])
    op.create_index("ix_research_feedback__run_id_created_at", "research_feedback", ["run_id", "created_at"])
    op.create_index("ix_research_feedback__target", "research_feedback", ["target_type", "target_id"])


def downgrade() -> None:
    op.drop_index("ix_research_feedback__target", table_name="research_feedback")
    op.drop_index("ix_research_feedback__run_id_created_at", table_name="research_feedback")
    op.drop_index("ix_research_feedback__user_id", table_name="research_feedback")
    op.drop_index("ix_research_feedback__run_id", table_name="research_feedback")
    op.drop_table("research_feedback")
    op.drop_index("ix_research_run_events__run_id_stage", table_name="research_run_events")
    op.drop_index("ix_research_run_events__run_id_sequence", table_name="research_run_events")
    op.drop_index("ix_research_run_events__run_id", table_name="research_run_events")
    op.drop_table("research_run_events")
    op.drop_table("pipeline_settings")
    op.drop_constraint("ck_research_runs__failed_error_message_required", "research_runs", type_="check")
    op.drop_constraint("ck_research_runs__terminal_completed_at_consistency", "research_runs", type_="check")
    op.drop_index("uq_research_runs__one_running_per_chat", table_name="research_runs")
    op.drop_constraint("ck_evidence_items__rank_positive", "evidence_items", type_="check")
    op.drop_constraint("ck_evidence_items__relevance_score_unit_range", "evidence_items", type_="check")
    op.drop_column("evidence_items", "rank")
    op.drop_column("evidence_items", "relevance_score")
    op.drop_column("document_chunks", "source_metadata")
    for enum_name in ("research_feedback_outcome", "research_feedback_target", "research_run_stage"):
        sa.Enum(name=enum_name).drop(op.get_bind(), checkfirst=True)
