import base64
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.models.chat_session import ChatSession
from app.models.debate_message import DebateMessage
from app.models.document_chunk import DocumentChunk
from app.models.evaluation_result import EvaluationResult
from app.models.evidence_item import EvidenceItem
from app.models.hypothesis_candidate import HypothesisCandidate
from app.models.hypothesis_evidence_link import HypothesisEvidenceLink
from app.models.hypothesis_version import HypothesisVersion
from app.models.judge_verdict import JudgeVerdict
from app.models.pipeline_settings import PipelineSettings
from app.models.research_feedback import ResearchFeedback
from app.models.research_input_item import ResearchInputItem
from app.models.research_run import ResearchRun
from app.models.research_run_event import ResearchRunEvent
from app.models.session_file import SessionFile
from app.models.user import User
from app.models.enums import DebateRole, EvidenceKind, EvidenceRelationKind, ResearchInputKind, ResearchRunStatus
from app.schemas.research import ResearchFeedbackCreateRequest, ResearchInputRequest
from app.services.exceptions import ConflictError, NotFoundError, ValidationError
from app.services.research_llm_orchestrator import (
    DebateDraft,
    EvaluationDraft,
    EvidenceDraft,
    HypothesisDraft,
    HypothesisEvidenceDraft,
)
from app.services.research_retrieval_service import RetrievalResult
from app.services.research_service import ResearchService


class DummySession:
    def __init__(self) -> None:
        self.commits = 0
        self.rollbacks = 0

    def commit(self) -> None:
        self.commits += 1

    def rollback(self) -> None:
        self.rollbacks += 1

    def flush(self) -> None:
        pass


class FakeResearchRepository:
    def __init__(self, chat_session: ChatSession) -> None:
        self.chat_session = chat_session
        self.running = False
        self.runs: list[ResearchRun] = []
        self.inputs: list[ResearchInputItem] = []
        self.files: list[SessionFile] = []
        self.chunks: list[DocumentChunk] = []
        self.evidence: list[EvidenceItem] = []
        self.hypotheses: list[HypothesisCandidate] = []
        self.links: list[HypothesisEvidenceLink] = []
        self.versions: list[HypothesisVersion] = []
        self.messages: list[DebateMessage] = []
        self.evaluations: list[EvaluationResult] = []
        self.verdicts: list[JudgeVerdict] = []
        self.events: list[ResearchRunEvent] = []
        self.feedback: list[ResearchFeedback] = []
        self.pipeline_settings = PipelineSettings(
            settings_key="global",
            default_hypothesis_count=3,
            debate_round_limit=2,
            retrieval_limit=16,
            evaluator_weights={},
            excluded_directions="",
            domain_constraints="",
        )

    def _store(self, collection, item):
        now = datetime.now(UTC)
        if getattr(item, "id", None) is None:
            item.id = uuid.uuid4()
        if hasattr(item, "created_at") and getattr(item, "created_at", None) is None:
            item.created_at = now
        if hasattr(item, "updated_at") and getattr(item, "updated_at", None) is None:
            item.updated_at = now
        collection.append(item)
        return item

    def get_chat_session(self, session, *, user_id, chat_session_id, for_update=False):
        del session, for_update
        if self.chat_session.user_id == user_id and self.chat_session.id == chat_session_id:
            return self.chat_session
        return None

    def has_running_run(self, session, *, chat_session_id):
        del session, chat_session_id
        return self.running

    def next_version_number(self, session, *, chat_session_id):
        del session, chat_session_id
        return len(self.runs) + 1

    def create_run(self, session, run):
        del session
        return self._store(self.runs, run)

    def get_pipeline_settings(self, session):
        del session
        return self.pipeline_settings

    def create_input_item(self, session, item):
        del session
        return self._store(self.inputs, item)

    def next_event_sequence_number(self, session, *, run_id):
        del session
        return len([item for item in self.events if item.run_id == run_id]) + 1

    def create_run_event(self, session, event):
        del session
        return self._store(self.events, event)

    def list_run_events(self, session, *, run_id):
        del session
        return [item for item in self.events if item.run_id == run_id]

    def list_runs(self, session, *, user_id, chat_session_id):
        del session
        return [run for run in self.runs if run.user_id == user_id and run.chat_session_id == chat_session_id]

    def get_run(self, session, *, user_id, chat_session_id, run_id, for_update=False):
        del session, for_update
        return next(
            (
                run
                for run in self.runs
                if run.user_id == user_id and run.chat_session_id == chat_session_id and run.id == run_id
            ),
            None,
        )

    def get_active_run(self, session, *, user_id, chat_session_id):
        del session
        if self.chat_session.active_research_run_id is None:
            return None
        return self.get_run(
            None,
            user_id=user_id,
            chat_session_id=chat_session_id,
            run_id=self.chat_session.active_research_run_id,
        )

    def list_active_files(self, session, *, user_id, chat_session_id):
        del session
        return [
            item
            for item in self.files
            if item.user_id == user_id and item.chat_session_id == chat_session_id and item.deleted_at is None
        ]

    def list_chunks_for_file(self, session, *, session_file_id):
        del session
        return [chunk for chunk in self.chunks if chunk.session_file_id == session_file_id]

    def search_chunks_by_vector(self, session, *, user_id, chat_session_id, query_vector, limit):
        del session, query_vector
        chunks = [
            item
            for item in self.chunks
            if item.user_id == user_id and item.chat_session_id == chat_session_id and item.embedding_vector is not None
        ]
        return [(chunk, 0.99 - index * 0.01) for index, chunk in enumerate(chunks[:limit])]

    def create_chunk(self, session, chunk):
        del session
        return self._store(self.chunks, chunk)

    def create_evidence(self, session, evidence):
        del session
        return self._store(self.evidence, evidence)

    def create_hypothesis(self, session, hypothesis):
        del session
        return self._store(self.hypotheses, hypothesis)

    def create_hypothesis_evidence_link(self, session, link):
        del session
        return self._store(self.links, link)

    def create_hypothesis_version(self, session, version):
        del session
        return self._store(self.versions, version)

    def create_debate_message(self, session, message):
        del session
        return self._store(self.messages, message)

    def list_selected_agents(self, session, *, user_id, chat_session_id):
        del session, user_id, chat_session_id
        return []

    def create_evaluation_result(self, session, result):
        del session
        return self._store(self.evaluations, result)

    def create_judge_verdict(self, session, verdict):
        del session
        return self._store(self.verdicts, verdict)

    def create_feedback(self, session, feedback):
        del session
        return self._store(self.feedback, feedback)

    def list_feedback(self, session, *, run_id):
        del session
        return [item for item in self.feedback if item.run_id == run_id]

    def list_input_items(self, session, *, run_id):
        del session
        return [item for item in self.inputs if item.run_id == run_id]

    def list_evidence(self, session, *, run_id):
        del session
        return [item for item in self.evidence if item.run_id == run_id]

    def list_hypotheses(self, session, *, run_id):
        del session
        return [item for item in self.hypotheses if item.run_id == run_id]

    def list_hypothesis_versions(self, session, *, hypothesis_ids):
        del session
        return [item for item in self.versions if item.hypothesis_id in hypothesis_ids]

    def list_evidence_links(self, session, *, hypothesis_ids):
        del session
        return [item for item in self.links if item.hypothesis_id in hypothesis_ids]

    def list_debate_messages(self, session, *, hypothesis_ids):
        del session
        return [item for item in self.messages if item.hypothesis_id in hypothesis_ids]

    def list_evaluation_results(self, session, *, run_id):
        del session
        return [item for item in self.evaluations if item.run_id == run_id]

    def get_judge_verdict(self, session, *, run_id):
        del session
        return next((item for item in self.verdicts if item.run_id == run_id), None)


class FakeRetrievalService:
    def __init__(self) -> None:
        self.calls = 0

    def ensure_chunk_embeddings(self, chunks):
        for chunk in chunks:
            chunk.embedding = [1.0, 0.0]
            chunk.embedding_vector = None
            chunk.embedding_dimensions = 2
            chunk.embedding_model = "fake-embedding"

    def embed_query(self, query):
        del query
        return [1.0, 0.0]

    def rank_with_query_vector(self, *, query_vector, chunks, limit):
        del query_vector
        self.calls += 1
        return [RetrievalResult(chunk=chunk, score=1 - index * 0.01) for index, chunk in enumerate(chunks[:limit])]

    def retrieve(self, *, query, chunks, limit):
        del query
        self.calls += 1
        return [RetrievalResult(chunk=chunk, score=1 - index * 0.01) for index, chunk in enumerate(chunks[:limit])]

    @staticmethod
    def to_source_fragments(results):
        return [
            SimpleNamespace(
                source_index=index,
                session_file_id=str(result.chunk.session_file_id),
                chunk_id=str(result.chunk.id),
                title=f"Фрагмент {index + 1}",
                text=result.chunk.content,
                score=result.score,
            )
            for index, result in enumerate(results)
        ]


class FakeLlmOrchestrator:
    def extract_evidence(self, *, research_brief, fragments, limit):
        del research_brief, limit
        if fragments:
            return [
                EvidenceDraft(
                    source_index=0,
                    kind=EvidenceKind.SUPPORT,
                    title="Подтверждённый эффект",
                    summary="Источник описывает полезный эффект для целевого KPI.",
                    quote="Улучшение прочности подтверждено серией опытов.",
                    confidence=Decimal("0.8100"),
                )
            ]
        return [
            EvidenceDraft(
                source_index=None,
                kind=EvidenceKind.UNKNOWN,
                title="Недостаточно источников",
                summary="Гипотеза строится на пользовательском brief, источники не приложены.",
                quote=None,
                confidence=Decimal("0.5000"),
            )
        ]

    def generate_hypotheses(self, *, research_brief, evidence, hypothesis_count):
        del research_brief, evidence
        return [
            HypothesisDraft(
                title=f"Гипотеза {index + 1}",
                statement=f"Проверить исследовательский маршрут {index + 1}.",
                mechanism="Механизм проверяется экспериментально.",
                kpi_alignment="Связано с KPI.",
                feasibility="Реализуемо на малой серии.",
                risk_profile="Главный риск - переносимость.",
                novelty="Отличается способом проверки.",
                evidence_links=[
                    HypothesisEvidenceDraft(
                        evidence_index=0,
                        relation=EvidenceRelationKind.SUPPORTS,
                        rationale="Evidence поддерживает формулировку.",
                    )
                ],
            )
            for index in range(hypothesis_count)
        ]

    def debate_hypothesis(self, *, hypothesis, evidence, round_number):
        del evidence, round_number
        return DebateDraft(
            messages=[
                (DebateRole.DEFENDER, "Аргументы в пользу гипотезы связаны с KPI."),
                (DebateRole.ATTACKER, "Нужно проверить слабые места доказательной базы."),
                (DebateRole.MANUFACTURER, "Реализуемость зависит от технологического окна."),
            ],
            refined_statement=f"{hypothesis.statement} Уточнить критерий успеха.",
            change_summary="Добавлен критерий проверки.",
        )

    def evaluate_hypothesis(self, *, evaluator_key, evaluator_name, evaluator_prompt, hypothesis, refined_statement, evidence):
        del evaluator_key, evaluator_prompt, hypothesis, refined_statement, evidence
        return EvaluationDraft(
            score=Decimal("76.00"),
            verdict=f"{evaluator_name}: умеренный потенциал",
            rationale="Оценка учитывает evidence и ограничения.",
            risk_notes="Риск зависит от воспроизводимости.",
        )

    def judge(self, *, research_brief, hypotheses, refined_statements, evidence, evaluations):
        del research_brief, refined_statements, evidence, evaluations
        return SimpleNamespace(
            summary="Судья сравнил гипотезы по evidence и оценкам.",
            recommendation="Начать с первой гипотезы и короткой экспериментальной проверки.",
            ranking=[
                {
                    "hypothesis_index": index,
                    "rank": index + 1,
                    "priority": "high" if index == 0 else "medium",
                }
                for index, _ in enumerate(hypotheses)
            ],
            next_checks=["Проверить KPI на малой серии."],
        )


class FailingLlmOrchestrator(FakeLlmOrchestrator):
    def extract_evidence(self, *, research_brief, fragments, limit):
        del research_brief, fragments, limit
        raise ValidationError("LLM недоступна")


class CrashingLlmOrchestrator(FakeLlmOrchestrator):
    def extract_evidence(self, *, research_brief, fragments, limit):
        del research_brief, fragments, limit
        raise RuntimeError("raw sql or secret should not leak")


def make_settings(tmp_path: Path):
    return SimpleNamespace(
        cors_allow_origins=(),
        postgres_db="db",
        postgres_user="user",
        postgres_password="password",
        auth_jwt_secret="secret",
        auth_access_token_ttl=timedelta(days=1),
        auth_refresh_token_ttl=timedelta(weeks=1),
        superadmin_username="superadmin",
        superadmin_password="password",
        superadmin_first_name=None,
        superadmin_last_name=None,
        chat_max_pinned_sessions=5,
        session_max_files=100,
        session_file_upload_max_bytes=100 * 1024 * 1024,
        user_max_agents=50,
        model_provider_base_url="https://example.com/v1",
        model_provider_api_key=None,
        model_provider_model="test-model",
        model_provider_folder_id=None,
        embedding_base_url="https://example.com/v1",
        embedding_api_key=None,
        embedding_model="text-embedding-3-large",
        embedding_folder_id=None,
        avatar_upload_max_bytes=5 * 1024 * 1024,
        uploads_dir=tmp_path,
    )


@pytest.fixture
def user() -> User:
    return User(id=uuid.uuid4(), username="researcher", password_hash="hash")


@pytest.fixture
def chat_session(user: User) -> ChatSession:
    return ChatSession(id=uuid.uuid4(), user_id=user.id, title="Новый чат")


@pytest.fixture
def service_bundle(tmp_path: Path, chat_session: ChatSession):
    session = DummySession()
    repository = FakeResearchRepository(chat_session)
    service = ResearchService(
        session=session,
        repository=repository,
        settings=make_settings(tmp_path),
        retrieval_service=FakeRetrievalService(),
        llm_orchestrator=FakeLlmOrchestrator(),
    )
    return service, repository, session


def input_requests() -> list[ResearchInputRequest]:
    return [
        ResearchInputRequest(kind=ResearchInputKind.KPI, label="KPI", text="Повысить прочность материала на 15%"),
        ResearchInputRequest(kind=ResearchInputKind.CONSTRAINTS, label="Ограничения", text="Без нового оборудования"),
        ResearchInputRequest(kind=ResearchInputKind.CONTEXT, label="Контекст", text="Проверка хвостов обогащения"),
    ]


def test_create_run_persists_complete_research_artifacts(service_bundle, user, chat_session):
    service, repository, session = service_bundle

    response = service.create_run(
        user=user,
        chat_session_id=chat_session.id,
        input_requests=input_requests(),
        hypothesis_count=3,
    )

    assert response.status == ResearchRunStatus.COMPLETED
    assert response.version_number == 1
    assert response.model_name == "test-model"
    assert response.inputs[0].kind == ResearchInputKind.KPI
    assert len(response.evidence) >= 1
    assert len(response.hypotheses) == 3
    assert all(len(hypothesis.versions) == 3 for hypothesis in response.hypotheses)
    assert all(len(hypothesis.debate_messages) == 6 for hypothesis in response.hypotheses)
    assert all(len(hypothesis.evaluations) == 2 for hypothesis in response.hypotheses)
    assert response.verdict is not None
    assert chat_session.active_research_run_id == response.id
    assert chat_session.is_started is True
    assert session.commits == 2
    assert repository.runs[0].completed_at is not None
    assert repository.events[-1].stage.value == "completed"
    assert repository.events[-1].progress_percent == 100


def test_create_run_blocks_when_another_run_is_running(service_bundle, user, chat_session):
    service, repository, session = service_bundle
    repository.running = True

    with pytest.raises(ConflictError):
        service.create_run(
            user=user,
            chat_session_id=chat_session.id,
            input_requests=input_requests(),
            hypothesis_count=3,
        )

    assert session.rollbacks == 1


def test_create_run_marks_run_failed_when_pipeline_dependency_fails(tmp_path, user, chat_session):
    session = DummySession()
    repository = FakeResearchRepository(chat_session)
    service = ResearchService(
        session=session,
        repository=repository,
        settings=make_settings(tmp_path),
        retrieval_service=FakeRetrievalService(),
        llm_orchestrator=FailingLlmOrchestrator(),
    )

    with pytest.raises(ValidationError):
        service.create_run(
            user=user,
            chat_session_id=chat_session.id,
            input_requests=input_requests(),
            hypothesis_count=3,
        )

    assert repository.runs[0].status == ResearchRunStatus.FAILED
    assert repository.runs[0].error_message == "LLM недоступна"
    assert repository.runs[0].completed_at is not None


def test_create_run_sanitizes_unexpected_pipeline_failure(tmp_path, user, chat_session):
    session = DummySession()
    repository = FakeResearchRepository(chat_session)
    service = ResearchService(
        session=session,
        repository=repository,
        settings=make_settings(tmp_path),
        retrieval_service=FakeRetrievalService(),
        llm_orchestrator=CrashingLlmOrchestrator(),
    )

    with pytest.raises(RuntimeError):
        service.create_run(
            user=user,
            chat_session_id=chat_session.id,
            input_requests=input_requests(),
            hypothesis_count=3,
        )

    assert repository.runs[0].status == ResearchRunStatus.FAILED
    assert repository.runs[0].error_message == "Внутренняя ошибка исследовательского пайплайна"


def test_regenerate_run_creates_new_version_with_parent(service_bundle, user, chat_session):
    service, _, _ = service_bundle
    first = service.create_run(
        user=user,
        chat_session_id=chat_session.id,
        input_requests=input_requests(),
        hypothesis_count=3,
    )

    second = service.regenerate_run(
        user=user,
        chat_session_id=chat_session.id,
        run_id=first.id,
        hypothesis_count=5,
    )

    assert second.version_number == 2
    assert second.parent_run_id == first.id
    assert second.hypothesis_count == 5
    assert len(second.hypotheses) == 5
    assert chat_session.active_research_run_id == second.id


def test_edit_run_creates_new_version_from_updated_inputs(service_bundle, user, chat_session):
    service, _, _ = service_bundle
    first = service.create_run(
        user=user,
        chat_session_id=chat_session.id,
        input_requests=input_requests(),
        hypothesis_count=3,
    )

    edited = service.edit_run(
        user=user,
        chat_session_id=chat_session.id,
        run_id=first.id,
        input_requests=[
            ResearchInputRequest(kind=ResearchInputKind.KPI, label="KPI", text="Снизить себестоимость на 8%"),
            ResearchInputRequest(kind=ResearchInputKind.CONTEXT, label="Контекст", text="Новая ветка проверки"),
        ],
        hypothesis_count=4,
    )

    assert edited.version_number == 2
    assert edited.parent_run_id == first.id
    assert edited.trigger.value == "edit"
    assert edited.hypothesis_count == 4
    assert edited.inputs[0].text == "Снизить себестоимость на 8%"
    assert chat_session.active_research_run_id == edited.id


def test_graph_contains_inputs_evidence_hypotheses_and_verdict(service_bundle, user, chat_session):
    service, _, _ = service_bundle
    run = service.create_run(
        user=user,
        chat_session_id=chat_session.id,
        input_requests=input_requests(),
        hypothesis_count=3,
    )

    graph = service.get_graph(user=user, chat_session_id=chat_session.id, run_id=run.id)

    node_types = {node.type for node in graph.nodes}
    edge_types = {edge.type for edge in graph.edges}
    assert {"run", "input", "evidence", "hypothesis", "verdict"}.issubset(node_types)
    assert "generates" in edge_types
    assert "synthesizes" in edge_types
    assert any(edge.source.startswith("evidence:") and edge.target.startswith("hypothesis:") for edge in graph.edges)
    assert "hypothesis_version" in node_types
    assert "debate_message" in node_types
    assert "evaluation" in node_types


def test_progress_lists_pipeline_events(service_bundle, user, chat_session):
    service, _, _ = service_bundle
    run = service.create_run(
        user=user,
        chat_session_id=chat_session.id,
        input_requests=input_requests(),
        hypothesis_count=3,
    )

    progress = service.get_progress(user=user, chat_session_id=chat_session.id, run_id=run.id)

    stages = [event.stage.value for event in progress.events]
    assert progress.progress_percent == 100
    assert stages[0] == "queued"
    assert "ingestion" in stages
    assert "judge" in stages
    assert stages[-1] == "completed"


def test_feedback_is_persisted_for_hypothesis(service_bundle, user, chat_session):
    service, _, _ = service_bundle
    run = service.create_run(
        user=user,
        chat_session_id=chat_session.id,
        input_requests=input_requests(),
        hypothesis_count=3,
    )
    hypothesis_id = run.hypotheses[0].id

    feedback = service.create_feedback(
        user=user,
        chat_session_id=chat_session.id,
        run_id=run.id,
        payload=ResearchFeedbackCreateRequest(
            target_type="hypothesis",
            target_id=hypothesis_id,
            outcome="needs_more_data",
            rating=3,
            comment="Нужно больше экспериментов.",
        ),
    )
    feedback_list = service.list_feedback(user=user, chat_session_id=chat_session.id, run_id=run.id)

    assert feedback.target_id == hypothesis_id
    assert feedback_list.items[0].comment == "Нужно больше экспериментов."


def test_export_run_returns_supported_report_formats(service_bundle, user, chat_session):
    service, _, _ = service_bundle
    run = service.create_run(
        user=user,
        chat_session_id=chat_session.id,
        input_requests=input_requests(),
        hypothesis_count=3,
    )

    json_export = service.export_run(user=user, chat_session_id=chat_session.id, run_id=run.id, export_format="json")
    markdown_export = service.export_run(user=user, chat_session_id=chat_session.id, run_id=run.id, export_format="md")
    csv_export = service.export_run(user=user, chat_session_id=chat_session.id, run_id=run.id, export_format="csv")
    docx_export = service.export_run(user=user, chat_session_id=chat_session.id, run_id=run.id, export_format="docx")
    pdf_export = service.export_run(user=user, chat_session_id=chat_session.id, run_id=run.id, export_format="pdf")

    assert json_export.content_type == "application/json"
    assert json_export.content_encoding == "text"
    assert '"hypotheses"' in json_export.content
    assert markdown_export.content_type.startswith("text/markdown")
    assert "## Вердикт" in markdown_export.content
    assert csv_export.content_type.startswith("text/csv")
    assert "hypothesis" in csv_export.content
    assert docx_export.content_encoding == "base64"
    assert base64.b64decode(docx_export.content).startswith(b"PK")
    assert pdf_export.content_encoding == "base64"
    assert base64.b64decode(pdf_export.content).startswith(b"%PDF")


def test_csv_export_escapes_spreadsheet_formulas(service_bundle, user, chat_session):
    service, _, _ = service_bundle
    run = service.create_run(
        user=user,
        chat_session_id=chat_session.id,
        input_requests=[
            ResearchInputRequest(kind=ResearchInputKind.KPI, label="KPI", text='=IMPORTXML("https://example.com")'),
            ResearchInputRequest(kind=ResearchInputKind.CONTEXT, label="Контекст", text="+unsafe"),
        ],
        hypothesis_count=3,
    )

    csv_export = service.export_run(user=user, chat_session_id=chat_session.id, run_id=run.id, export_format="csv")

    assert "'=IMPORTXML" in csv_export.content
    assert "'+unsafe" in csv_export.content


def test_activate_run_switches_active_version(service_bundle, user, chat_session):
    service, _, _ = service_bundle
    first = service.create_run(
        user=user,
        chat_session_id=chat_session.id,
        input_requests=input_requests(),
        hypothesis_count=3,
    )
    second = service.regenerate_run(
        user=user,
        chat_session_id=chat_session.id,
        run_id=first.id,
        hypothesis_count=3,
    )

    activated = service.activate_run(user=user, chat_session_id=chat_session.id, run_id=first.id)

    assert second.id != first.id
    assert activated.id == first.id
    assert chat_session.active_research_run_id == first.id


def test_activate_run_rejects_non_completed_version(service_bundle, user, chat_session):
    service, repository, _ = service_bundle
    run = repository.create_run(
        None,
        ResearchRun(
            id=uuid.uuid4(),
            chat_session_id=chat_session.id,
            user_id=user.id,
            version_number=1,
            trigger="initial",
            status=ResearchRunStatus.FAILED,
            title="Ошибочная версия",
            hypothesis_count=3,
        ),
    )

    with pytest.raises(ConflictError):
        service.activate_run(user=user, chat_session_id=chat_session.id, run_id=run.id)


def test_cancel_run_marks_running_version_cancelled(service_bundle, user, chat_session):
    service, repository, session = service_bundle
    run = repository.create_run(
        None,
        ResearchRun(
            id=uuid.uuid4(),
            chat_session_id=chat_session.id,
            user_id=user.id,
            version_number=1,
            trigger="initial",
            status=ResearchRunStatus.RUNNING,
            title="Выполняющаяся версия",
            hypothesis_count=3,
        ),
    )

    cancelled = service.cancel_run(user=user, chat_session_id=chat_session.id, run_id=run.id)

    assert cancelled.status == ResearchRunStatus.CANCELLED
    assert repository.runs[0].completed_at is not None
    assert session.commits == 1


def test_text_file_is_chunked_and_used_as_evidence(tmp_path, service_bundle, user, chat_session):
    service, repository, _ = service_bundle
    object_key = "session-files/example.txt"
    file_path = tmp_path / object_key
    file_path.parent.mkdir(parents=True)
    file_path.write_text("Улучшение прочности подтверждено серией опытов. Риск масштабирования остаётся.", encoding="utf-8")
    repository.files.append(
        SessionFile(
            id=uuid.uuid4(),
            chat_session_id=chat_session.id,
            user_id=user.id,
            original_filename="example.txt",
            object_key=object_key,
            kind="txt",
            size_bytes=file_path.stat().st_size,
        )
    )

    response = service.create_run(
        user=user,
        chat_session_id=chat_session.id,
        input_requests=input_requests(),
        hypothesis_count=3,
    )

    assert len(repository.chunks) == 1
    assert response.evidence[0].chunk_id == repository.chunks[0].id
    assert response.evidence[0].kind in {EvidenceKind.SUPPORT, EvidenceKind.RISK}


def test_regenerate_preserves_existing_chunk_references(tmp_path, service_bundle, user, chat_session):
    service, repository, _ = service_bundle
    object_key = "session-files/source.txt"
    file_path = tmp_path / object_key
    file_path.parent.mkdir(parents=True)
    file_path.write_text("Повысить извлечение металла без роста расхода реагентов.", encoding="utf-8")
    repository.files.append(
        SessionFile(
            id=uuid.uuid4(),
            chat_session_id=chat_session.id,
            user_id=user.id,
            original_filename="source.txt",
            object_key=object_key,
            kind="txt",
            size_bytes=file_path.stat().st_size,
        )
    )
    first = service.create_run(
        user=user,
        chat_session_id=chat_session.id,
        input_requests=input_requests(),
        hypothesis_count=3,
    )
    first_chunk_ids = {item.chunk_id for item in first.evidence if item.chunk_id is not None}

    second = service.regenerate_run(
        user=user,
        chat_session_id=chat_session.id,
        run_id=first.id,
        hypothesis_count=3,
    )
    second_chunk_ids = {item.chunk_id for item in second.evidence if item.chunk_id is not None}

    assert len(repository.chunks) == 1
    assert first_chunk_ids
    assert first_chunk_ids == second_chunk_ids


def test_existing_json_embeddings_are_promoted_to_vector_branch(service_bundle, user, chat_session):
    service, repository, _ = service_bundle
    chunk = DocumentChunk(
        id=uuid.uuid4(),
        session_file_id=uuid.uuid4(),
        chat_session_id=chat_session.id,
        user_id=user.id,
        position=0,
        content="legacy embedding chunk",
        content_hash="b" * 64,
        token_count=3,
        embedding=[0.001] * 3072,
        embedding_vector=None,
        embedding_dimensions=3072,
        embedding_model="legacy",
    )
    repository.chunks.append(chunk)

    class VectorRetrievalService(FakeRetrievalService):
        def ensure_chunk_embeddings(self, chunks):
            for item in chunks:
                if item.embedding and item.embedding_vector is None and len(item.embedding) == 3072:
                    item.embedding_vector = item.embedding

        def embed_query(self, query):
            del query
            return [0.001] * 3072

    service._retrieval_service = VectorRetrievalService()
    run = repository.create_run(
        None,
        ResearchRun(
            id=uuid.uuid4(),
            chat_session_id=chat_session.id,
            user_id=user.id,
            version_number=1,
            trigger="initial",
            status=ResearchRunStatus.RUNNING,
            title="Vector branch",
            hypothesis_count=3,
        ),
    )

    drafts, source_chunks = service._extract_evidence_drafts(
        run=run,
        research_brief="Повысить прочность",
        chunks=[chunk],
        retrieval_limit=3,
    )

    assert drafts
    assert source_chunks == [chunk]
    assert chunk.embedding_vector is not None


def test_broken_supported_file_marks_failed_without_failing_run(tmp_path, service_bundle, user, chat_session):
    service, repository, _ = service_bundle
    object_key = "session-files/report.pdf"
    file_path = tmp_path / object_key
    file_path.parent.mkdir(parents=True)
    file_path.write_bytes(b"%PDF-1.4")
    session_file = SessionFile(
        id=uuid.uuid4(),
        chat_session_id=chat_session.id,
        user_id=user.id,
        original_filename="report.pdf",
        object_key=object_key,
        kind="pdf",
        size_bytes=file_path.stat().st_size,
    )
    repository.files.append(session_file)

    response = service.create_run(
        user=user,
        chat_session_id=chat_session.id,
        input_requests=input_requests(),
        hypothesis_count=3,
    )

    assert response.status == ResearchRunStatus.COMPLETED
    assert session_file.processing_status.value == "failed"
    assert session_file.processing_error


def test_validation_rejects_blank_input(service_bundle, user, chat_session):
    service, _, session = service_bundle

    with pytest.raises(ValidationError):
        service.create_run(
            user=user,
            chat_session_id=chat_session.id,
            input_requests=[ResearchInputRequest(kind=ResearchInputKind.KPI, label="KPI", text=" ")],
            hypothesis_count=3,
        )

    assert session.rollbacks == 0


def test_get_active_run_requires_existing_active_run(service_bundle, user, chat_session):
    service, _, _ = service_bundle

    with pytest.raises(NotFoundError):
        service.get_active_run(user=user, chat_session_id=chat_session.id)
