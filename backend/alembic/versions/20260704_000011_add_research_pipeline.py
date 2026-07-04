"""add research pipeline schema

Revision ID: 20260704_000011
Revises: 20260704_000010
Create Date: 2026-07-04 23:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260704_000011"
down_revision = "20260704_000010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    research_run_status = sa.Enum("running", "completed", "failed", "cancelled", name="research_run_status")
    research_run_trigger = sa.Enum("initial", "edit", "regenerate", name="research_run_trigger")
    research_input_kind = sa.Enum("kpi", "constraints", "context", "custom", name="research_input_kind")
    document_processing_status = sa.Enum(
        "uploaded",
        "processing",
        "processed",
        "failed",
        "unsupported",
        name="document_processing_status",
    )
    evidence_kind = sa.Enum("support", "contradiction", "risk", "constraint", "unknown", name="evidence_kind")
    evidence_relation_kind = sa.Enum(
        "supports",
        "contradicts",
        "risk",
        "constrains",
        name="evidence_relation_kind",
    )
    debate_role = sa.Enum("defender", "attacker", "manufacturer", name="debate_role")

    for enum_type in (
        research_run_status,
        research_run_trigger,
        research_input_kind,
        document_processing_status,
        evidence_kind,
        evidence_relation_kind,
        debate_role,
    ):
        enum_type.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "chat_sessions",
        sa.Column("active_research_run_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "session_files",
        sa.Column(
            "processing_status",
            postgresql.ENUM(
                "uploaded",
                "processing",
                "processed",
                "failed",
                "unsupported",
                name="document_processing_status",
                create_type=False,
            ),
            nullable=False,
            server_default="uploaded",
        ),
    )
    op.add_column("session_files", sa.Column("processing_error", sa.Text(), nullable=True))
    op.add_column("session_files", sa.Column("text_extracted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("session_files", sa.Column("storage_deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("session_files", sa.Column("storage_delete_error", sa.Text(), nullable=True))

    op.create_table(
        "research_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("chat_session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("parent_run_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column(
            "trigger",
            postgresql.ENUM("initial", "edit", "regenerate", name="research_run_trigger", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM("running", "completed", "failed", "cancelled", name="research_run_status", create_type=False),
            nullable=False,
            server_default="running",
        ),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("input_hash", sa.String(length=64), nullable=True),
        sa.Column("model_name", sa.String(length=255), nullable=True),
        sa.Column("hypothesis_count", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["chat_session_id"], ["chat_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_run_id"], ["research_runs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("chat_session_id", "version_number", name="uq_research_runs__chat_session_id_version_number"),
        sa.CheckConstraint("version_number >= 1", name="ck_research_runs__version_number_positive"),
        sa.CheckConstraint("hypothesis_count between 3 and 5", name="ck_research_runs__hypothesis_count_supported"),
        sa.CheckConstraint(
            "btrim(title) = title and char_length(title) between 1 and 200",
            name="ck_research_runs__title_trimmed_length",
        ),
        sa.CheckConstraint("input_hash is null or char_length(input_hash) = 64", name="ck_research_runs__input_hash_sha256"),
        sa.CheckConstraint(
            "error_message is null or char_length(error_message) <= 2000",
            name="ck_research_runs__error_message_max_length",
        ),
        sa.CheckConstraint(
            "completed_at is null or started_at is null or completed_at >= started_at",
            name="ck_research_runs__completed_after_started",
        ),
    )
    op.create_index("ix_research_runs__chat_session_id", "research_runs", ["chat_session_id"])
    op.create_index("ix_research_runs__user_id", "research_runs", ["user_id"])
    op.create_index("ix_research_runs__chat_session_id_created_at", "research_runs", ["chat_session_id", "created_at"])
    op.create_index("ix_research_runs__chat_session_id_status", "research_runs", ["chat_session_id", "status"])

    op.create_foreign_key(
        "fk_chat_sessions__active_research_run_id__research_runs",
        "chat_sessions",
        "research_runs",
        ["active_research_run_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_chat_sessions__active_research_run_id", "chat_sessions", ["active_research_run_id"])

    op.create_table(
        "research_input_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("kind", postgresql.ENUM("kpi", "constraints", "context", "custom", name="research_input_kind", create_type=False), nullable=False),
        sa.Column("label", sa.String(length=64), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["run_id"], ["research_runs.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("run_id", "position", name="uq_research_input_items__run_id_position"),
        sa.CheckConstraint("position >= 0", name="ck_research_input_items__position_non_negative"),
        sa.CheckConstraint("btrim(label) = label and char_length(label) between 1 and 64", name="ck_research_input_items__label_trimmed_length"),
        sa.CheckConstraint("btrim(text) = text and char_length(text) between 1 and 4000", name="ck_research_input_items__text_trimmed_length"),
    )
    op.create_index("ix_research_input_items__run_id", "research_input_items", ["run_id"])

    op.create_table(
        "document_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("session_file_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("chat_session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("embedding", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("embedding_model", sa.String(length=255), nullable=True),
        sa.Column("embedding_dimensions", sa.Integer(), nullable=True),
        sa.Column("embedded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["chat_session_id"], ["chat_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["session_file_id"], ["session_files.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("session_file_id", "position", name="uq_document_chunks__session_file_id_position"),
        sa.CheckConstraint("position >= 0", name="ck_document_chunks__position_non_negative"),
        sa.CheckConstraint("char_length(content_hash) = 64", name="ck_document_chunks__content_hash_sha256"),
        sa.CheckConstraint("btrim(content) = content and char_length(content) > 0", name="ck_document_chunks__content_not_blank"),
        sa.CheckConstraint("embedding_dimensions is null or embedding_dimensions > 0", name="ck_document_chunks__embedding_dimensions_positive"),
        sa.CheckConstraint("embedding_model is null or char_length(embedding_model) <= 255", name="ck_document_chunks__embedding_model_max_length"),
    )
    op.create_index("ix_document_chunks__session_file_id", "document_chunks", ["session_file_id"])
    op.create_index("ix_document_chunks__chat_session_id", "document_chunks", ["chat_session_id"])
    op.create_index("ix_document_chunks__user_id", "document_chunks", ["user_id"])
    op.create_index("ix_document_chunks__chat_session_id_position", "document_chunks", ["chat_session_id", "position"])

    op.create_table(
        "evidence_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_file_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("chunk_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("kind", postgresql.ENUM("support", "contradiction", "risk", "constraint", "unknown", name="evidence_kind", create_type=False), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("quote", sa.Text(), nullable=True),
        sa.Column("confidence", sa.Numeric(5, 4), nullable=False),
        sa.Column("item_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["chunk_id"], ["document_chunks.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["run_id"], ["research_runs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["session_file_id"], ["session_files.id"], ondelete="SET NULL"),
        sa.CheckConstraint("btrim(title) = title and char_length(title) between 1 and 200", name="ck_evidence_items__title_trimmed_length"),
        sa.CheckConstraint("btrim(summary) = summary and char_length(summary) between 1 and 2000", name="ck_evidence_items__summary_trimmed_length"),
        sa.CheckConstraint("quote is null or char_length(quote) <= 2000", name="ck_evidence_items__quote_max_length"),
        sa.CheckConstraint("confidence >= 0 and confidence <= 1", name="ck_evidence_items__confidence_unit_range"),
    )
    op.create_index("ix_evidence_items__run_id", "evidence_items", ["run_id"])
    op.create_index("ix_evidence_items__session_file_id", "evidence_items", ["session_file_id"])
    op.create_index("ix_evidence_items__chunk_id", "evidence_items", ["chunk_id"])
    op.create_index("ix_evidence_items__run_id_kind", "evidence_items", ["run_id", "kind"])

    op.create_table(
        "hypothesis_candidates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("statement", sa.Text(), nullable=False),
        sa.Column("mechanism", sa.Text(), nullable=False, server_default=""),
        sa.Column("kpi_alignment", sa.Text(), nullable=False, server_default=""),
        sa.Column("feasibility", sa.Text(), nullable=False, server_default=""),
        sa.Column("risk_profile", sa.Text(), nullable=False, server_default=""),
        sa.Column("novelty", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["run_id"], ["research_runs.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("run_id", "position", name="uq_hypothesis_candidates__run_id_position"),
        sa.CheckConstraint("position >= 0", name="ck_hypothesis_candidates__position_non_negative"),
        sa.CheckConstraint("btrim(title) = title and char_length(title) between 1 and 120", name="ck_hypothesis_candidates__title_trimmed_length"),
        sa.CheckConstraint("btrim(statement) = statement and char_length(statement) between 1 and 3000", name="ck_hypothesis_candidates__statement_trimmed_length"),
        sa.CheckConstraint("char_length(mechanism) <= 3000", name="ck_hypothesis_candidates__mechanism_max_length"),
        sa.CheckConstraint("char_length(kpi_alignment) <= 2000", name="ck_hypothesis_candidates__kpi_alignment_max_length"),
        sa.CheckConstraint("char_length(feasibility) <= 2000", name="ck_hypothesis_candidates__feasibility_max_length"),
        sa.CheckConstraint("char_length(risk_profile) <= 2000", name="ck_hypothesis_candidates__risk_profile_max_length"),
        sa.CheckConstraint("char_length(novelty) <= 2000", name="ck_hypothesis_candidates__novelty_max_length"),
    )
    op.create_index("ix_hypothesis_candidates__run_id", "hypothesis_candidates", ["run_id"])
    op.create_index("ix_hypothesis_candidates__run_id_position", "hypothesis_candidates", ["run_id", "position"])

    op.create_table(
        "hypothesis_evidence_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("hypothesis_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("evidence_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("relation", postgresql.ENUM("supports", "contradicts", "risk", "constrains", name="evidence_relation_kind", create_type=False), nullable=False),
        sa.Column("rationale", sa.String(length=1000), nullable=True),
        sa.ForeignKeyConstraint(["evidence_id"], ["evidence_items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["hypothesis_id"], ["hypothesis_candidates.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "hypothesis_id",
            "evidence_id",
            "relation",
            name="uq_hypothesis_evidence_links__hypothesis_evidence_relation",
        ),
        sa.CheckConstraint("rationale is null or char_length(rationale) <= 1000", name="ck_hypothesis_evidence_links__rationale_max_length"),
    )
    op.create_index("ix_hypothesis_evidence_links__hypothesis_id", "hypothesis_evidence_links", ["hypothesis_id"])
    op.create_index("ix_hypothesis_evidence_links__evidence_id", "hypothesis_evidence_links", ["evidence_id"])

    op.create_table(
        "hypothesis_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("hypothesis_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("statement", sa.Text(), nullable=False),
        sa.Column("change_summary", sa.Text(), nullable=True),
        sa.Column("created_by_role", postgresql.ENUM("defender", "attacker", "manufacturer", name="debate_role", create_type=False), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["hypothesis_id"], ["hypothesis_candidates.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("hypothesis_id", "version_number", name="uq_hypothesis_versions__hypothesis_id_version_number"),
        sa.CheckConstraint("version_number >= 1", name="ck_hypothesis_versions__version_number_positive"),
        sa.CheckConstraint("btrim(statement) = statement and char_length(statement) between 1 and 3000", name="ck_hypothesis_versions__statement_trimmed_length"),
        sa.CheckConstraint("change_summary is null or char_length(change_summary) <= 2000", name="ck_hypothesis_versions__change_summary_max_length"),
    )
    op.create_index("ix_hypothesis_versions__hypothesis_id", "hypothesis_versions", ["hypothesis_id"])

    op.create_table(
        "debate_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("hypothesis_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_version_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("round_number", sa.Integer(), nullable=False),
        sa.Column("role", postgresql.ENUM("defender", "attacker", "manufacturer", name="debate_role", create_type=False), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["hypothesis_id"], ["hypothesis_candidates.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_version_id"], ["hypothesis_versions.id"], ondelete="SET NULL"),
        sa.CheckConstraint("round_number >= 1", name="ck_debate_messages__round_number_positive"),
        sa.CheckConstraint("btrim(content) = content and char_length(content) between 1 and 4000", name="ck_debate_messages__content_trimmed_length"),
    )
    op.create_index("ix_debate_messages__hypothesis_id", "debate_messages", ["hypothesis_id"])
    op.create_index("ix_debate_messages__hypothesis_id_round_role", "debate_messages", ["hypothesis_id", "round_number", "role"])

    op.create_table(
        "evaluation_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("hypothesis_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_agent_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("evaluator_key", sa.String(length=120), nullable=False),
        sa.Column("evaluator_name", sa.String(length=120), nullable=False),
        sa.Column("score", sa.Numeric(5, 2), nullable=False),
        sa.Column("verdict", sa.Text(), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=True),
        sa.Column("risk_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["hypothesis_id"], ["hypothesis_candidates.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["run_id"], ["research_runs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_agent_id"], ["user_agents.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("hypothesis_id", "evaluator_key", name="uq_evaluation_results__hypothesis_id_evaluator_key"),
        sa.CheckConstraint("btrim(evaluator_key) = evaluator_key and char_length(evaluator_key) between 1 and 120", name="ck_evaluation_results__evaluator_key_trimmed_length"),
        sa.CheckConstraint("btrim(evaluator_name) = evaluator_name and char_length(evaluator_name) between 1 and 120", name="ck_evaluation_results__evaluator_name_trimmed_length"),
        sa.CheckConstraint("score >= 0 and score <= 100", name="ck_evaluation_results__score_percent_range"),
        sa.CheckConstraint("btrim(verdict) = verdict and char_length(verdict) between 1 and 2000", name="ck_evaluation_results__verdict_trimmed_length"),
        sa.CheckConstraint("rationale is null or char_length(rationale) <= 3000", name="ck_evaluation_results__rationale_max_length"),
        sa.CheckConstraint("risk_notes is null or char_length(risk_notes) <= 3000", name="ck_evaluation_results__risk_notes_max_length"),
    )
    op.create_index("ix_evaluation_results__run_id", "evaluation_results", ["run_id"])
    op.create_index("ix_evaluation_results__hypothesis_id", "evaluation_results", ["hypothesis_id"])
    op.create_index("ix_evaluation_results__user_agent_id", "evaluation_results", ["user_agent_id"])

    op.create_table(
        "judge_verdicts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("recommendation", sa.Text(), nullable=False),
        sa.Column("ranking", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("next_checks", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["run_id"], ["research_runs.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("run_id", name="uq_judge_verdicts__run_id"),
        sa.CheckConstraint("btrim(summary) = summary and char_length(summary) between 1 and 4000", name="ck_judge_verdicts__summary_trimmed_length"),
        sa.CheckConstraint("btrim(recommendation) = recommendation and char_length(recommendation) between 1 and 4000", name="ck_judge_verdicts__recommendation_trimmed_length"),
    )
    op.create_index("ix_judge_verdicts__run_id", "judge_verdicts", ["run_id"])


def downgrade() -> None:
    op.drop_index("ix_judge_verdicts__run_id", table_name="judge_verdicts")
    op.drop_table("judge_verdicts")
    op.drop_index("ix_evaluation_results__user_agent_id", table_name="evaluation_results")
    op.drop_index("ix_evaluation_results__hypothesis_id", table_name="evaluation_results")
    op.drop_index("ix_evaluation_results__run_id", table_name="evaluation_results")
    op.drop_table("evaluation_results")
    op.drop_index("ix_debate_messages__hypothesis_id_round_role", table_name="debate_messages")
    op.drop_index("ix_debate_messages__hypothesis_id", table_name="debate_messages")
    op.drop_table("debate_messages")
    op.drop_index("ix_hypothesis_versions__hypothesis_id", table_name="hypothesis_versions")
    op.drop_table("hypothesis_versions")
    op.drop_index("ix_hypothesis_evidence_links__evidence_id", table_name="hypothesis_evidence_links")
    op.drop_index("ix_hypothesis_evidence_links__hypothesis_id", table_name="hypothesis_evidence_links")
    op.drop_table("hypothesis_evidence_links")
    op.drop_index("ix_hypothesis_candidates__run_id_position", table_name="hypothesis_candidates")
    op.drop_index("ix_hypothesis_candidates__run_id", table_name="hypothesis_candidates")
    op.drop_table("hypothesis_candidates")
    op.drop_index("ix_evidence_items__run_id_kind", table_name="evidence_items")
    op.drop_index("ix_evidence_items__chunk_id", table_name="evidence_items")
    op.drop_index("ix_evidence_items__session_file_id", table_name="evidence_items")
    op.drop_index("ix_evidence_items__run_id", table_name="evidence_items")
    op.drop_table("evidence_items")
    op.drop_index("ix_document_chunks__chat_session_id_position", table_name="document_chunks")
    op.drop_index("ix_document_chunks__user_id", table_name="document_chunks")
    op.drop_index("ix_document_chunks__chat_session_id", table_name="document_chunks")
    op.drop_index("ix_document_chunks__session_file_id", table_name="document_chunks")
    op.drop_table("document_chunks")
    op.drop_index("ix_research_input_items__run_id", table_name="research_input_items")
    op.drop_table("research_input_items")
    op.drop_index("ix_chat_sessions__active_research_run_id", table_name="chat_sessions")
    op.drop_constraint("fk_chat_sessions__active_research_run_id__research_runs", "chat_sessions", type_="foreignkey")
    op.drop_index("ix_research_runs__chat_session_id_status", table_name="research_runs")
    op.drop_index("ix_research_runs__chat_session_id_created_at", table_name="research_runs")
    op.drop_index("ix_research_runs__user_id", table_name="research_runs")
    op.drop_index("ix_research_runs__chat_session_id", table_name="research_runs")
    op.drop_table("research_runs")
    op.drop_column("session_files", "text_extracted_at")
    op.drop_column("session_files", "processing_error")
    op.drop_column("session_files", "processing_status")
    op.drop_column("session_files", "storage_delete_error")
    op.drop_column("session_files", "storage_deleted_at")
    op.drop_column("chat_sessions", "active_research_run_id")

    for enum_name in (
        "debate_role",
        "evidence_relation_kind",
        "evidence_kind",
        "document_processing_status",
        "research_input_kind",
        "research_run_trigger",
        "research_run_status",
    ):
        sa.Enum(name=enum_name).drop(op.get_bind(), checkfirst=True)
