import uuid
from datetime import timedelta
from pathlib import Path
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.api.deps.auth import get_current_user
from app.api.routes import research as research_routes
from app.core.settings import get_settings
from app.db.session import get_db_session
from app.main import create_app
from app.models.chat_session import ChatSession
from app.models.user import User
from app.services.research_service import ResearchService
from test_research_service import FakeLlmOrchestrator, FakeResearchRepository, FakeRetrievalService


class DummySession:
    def commit(self) -> None:
        pass

    def rollback(self) -> None:
        pass


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


def test_research_api_contracts(monkeypatch, tmp_path):
    user = User(id=uuid.uuid4(), username="researcher", password_hash="hash", token_version=1)
    chat_session = ChatSession(id=uuid.uuid4(), user_id=user.id, title="API test")
    repository = FakeResearchRepository(chat_session)
    settings = make_settings(tmp_path)

    def get_session_override():
        yield DummySession()

    def get_service_override(session, settings):
        del session
        return ResearchService(
            session=DummySession(),
            repository=repository,
            settings=settings,
            retrieval_service=FakeRetrievalService(),
            llm_orchestrator=FakeLlmOrchestrator(),
        )

    monkeypatch.setattr(research_routes, "_get_research_service", get_service_override)

    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db_session] = get_session_override
    app.dependency_overrides[get_settings] = lambda: settings
    client = TestClient(app)

    create_response = client.post(
        f"/chat-sessions/{chat_session.id}/research-runs",
        json={
            "hypothesis_count": 3,
            "inputs": [
                {"kind": "kpi", "label": "KPI", "text": "Повысить прочность"},
                {"kind": "constraints", "label": "Ограничения", "text": "Без нового оборудования"},
                {"kind": "context", "label": "Контекст", "text": "API contract"},
            ],
        },
    )
    assert create_response.status_code == 201
    run = create_response.json()
    assert run["status"] == "completed"

    progress_response = client.get(f"/chat-sessions/{chat_session.id}/research-runs/{run['id']}/progress")
    assert progress_response.status_code == 200
    assert progress_response.json()["progress_percent"] == 100

    graph_response = client.get(f"/chat-sessions/{chat_session.id}/research-runs/{run['id']}/graph")
    assert graph_response.status_code == 200
    assert {"hypothesis_version", "debate_message", "evaluation"}.issubset(
        {node["type"] for node in graph_response.json()["nodes"]}
    )

    feedback_response = client.post(
        f"/chat-sessions/{chat_session.id}/research-runs/{run['id']}/feedback",
        json={
            "target_type": "run",
            "target_id": run["id"],
            "outcome": "confirmed",
            "rating": 5,
            "comment": "Подходит для проверки",
        },
    )
    assert feedback_response.status_code == 201

    export_response = client.get(f"/chat-sessions/{chat_session.id}/research-runs/{run['id']}/export?format=md")
    assert export_response.status_code == 200
    assert "## Вердикт" in export_response.json()["content"]
