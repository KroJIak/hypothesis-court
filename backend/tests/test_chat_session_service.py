import uuid

from app.models.chat_session import ChatSession
from app.models.enums import ResearchInputKind
from app.models.user import User
from app.schemas.chat_session import ChatSessionDraftInput
from app.services.chat_session_service import ChatSessionService
from app.services.exceptions import ValidationError


class DummySession:
    def __init__(self) -> None:
        self.commits = 0
        self.rollbacks = 0

    def commit(self) -> None:
        self.commits += 1

    def rollback(self) -> None:
        self.rollbacks += 1


class FakeChatSessionRepository:
    def __init__(self, empty_unstarted_session=None) -> None:
        self.empty_unstarted_session = empty_unstarted_session
        self.created_sessions = []

    def get_empty_unstarted_for_user(self, session, *, user_id):
        del session, user_id
        return self.empty_unstarted_session

    def create(self, session, chat_session):
        del session
        chat_session.id = uuid.uuid4()
        self.created_sessions.append(chat_session)
        return chat_session

    def get_active_for_user(self, session, *, user_id, chat_session_id):
        del session
        if self.empty_unstarted_session and self.empty_unstarted_session.user_id == user_id:
            if self.empty_unstarted_session.id == chat_session_id:
                return self.empty_unstarted_session
        return None


def make_service(repository, session):
    return ChatSessionService(
        session=session,
        chat_session_repository=repository,
    )


def test_create_session_reuses_only_empty_unstarted_session():
    user = User(id=uuid.uuid4(), username="researcher", password_hash="hash", token_version=1)
    existing_session = ChatSession(id=uuid.uuid4(), user_id=user.id, title="Новый чат")
    repository = FakeChatSessionRepository(empty_unstarted_session=existing_session)
    session = DummySession()
    service = make_service(repository, session)

    chat_session, was_created = service.create_session(user=user, title="Новый чат")

    assert chat_session is existing_session
    assert was_created is False
    assert repository.created_sessions == []
    assert session.commits == 0
    assert session.rollbacks == 0


def test_create_session_creates_new_session_when_no_empty_draft_exists():
    user = User(id=uuid.uuid4(), username="researcher", password_hash="hash", token_version=1)
    repository = FakeChatSessionRepository(empty_unstarted_session=None)
    session = DummySession()
    service = make_service(repository, session)

    chat_session, was_created = service.create_session(user=user, title="Новый чат")

    assert chat_session.id is not None
    assert chat_session.user_id == user.id
    assert chat_session.title == "Новый чат"
    assert chat_session.draft_inputs == []
    assert was_created is True
    assert repository.created_sessions == [chat_session]
    assert session.commits == 1
    assert session.rollbacks == 0


def test_update_draft_inputs_normalizes_and_persists_values():
    user = User(id=uuid.uuid4(), username="researcher", password_hash="hash", token_version=1)
    existing_session = ChatSession(id=uuid.uuid4(), user_id=user.id, title="Новый чат", draft_inputs=[])
    repository = FakeChatSessionRepository(empty_unstarted_session=existing_session)
    session = DummySession()
    service = make_service(repository, session)

    chat_session = service.update_draft_inputs(
        user=user,
        chat_session_id=existing_session.id,
        inputs=[
            ChatSessionDraftInput(
                kind=ResearchInputKind.KPI,
                label=" KPI ",
                text=" Повысить извлечение на 7% ",
            ),
        ],
    )

    assert chat_session.draft_inputs == [
        {
            "kind": "kpi",
            "label": "KPI",
            "text": "Повысить извлечение на 7%",
        }
    ]
    assert session.commits == 1
    assert session.rollbacks == 0


def test_update_draft_inputs_rejects_blank_text():
    user = User(id=uuid.uuid4(), username="researcher", password_hash="hash", token_version=1)
    existing_session = ChatSession(id=uuid.uuid4(), user_id=user.id, title="Новый чат", draft_inputs=[])
    repository = FakeChatSessionRepository(empty_unstarted_session=existing_session)
    session = DummySession()
    service = make_service(repository, session)

    try:
        service.update_draft_inputs(
            user=user,
            chat_session_id=existing_session.id,
            inputs=[ChatSessionDraftInput(kind=ResearchInputKind.CONTEXT, label="Контекст", text=" ")],
        )
    except ValidationError as exc:
        assert exc.detail == "Текст поля ввода не может быть пустым."
    else:
        raise AssertionError("Expected ValidationError")

    assert session.commits == 0
    assert session.rollbacks == 1
