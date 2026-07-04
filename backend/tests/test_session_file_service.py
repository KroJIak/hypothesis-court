import asyncio
import uuid

from app.models.chat_session import ChatSession
from app.models.session_file import SessionFile
from app.models.user import User
from app.services.exceptions import ValidationError
from app.services.session_file_service import SessionFileService
from app.services.session_file_storage import SessionFileStorage


class FakeUploadFile:
    def __init__(self, *, filename: str, content: bytes, content_type: str | None = None) -> None:
        self.filename = filename
        self.content_type = content_type
        self._content = content
        self._cursor = 0

    async def read(self, size: int) -> bytes:
        if self._cursor >= len(self._content):
            return b""
        chunk = self._content[self._cursor : self._cursor + size]
        self._cursor += len(chunk)
        return chunk


class DummySession:
    def __init__(self, session_file: SessionFile) -> None:
        self.session_file = session_file
        self.commits = 0
        self.rollbacks = 0

    def commit(self) -> None:
        self.commits += 1

    def rollback(self) -> None:
        self.rollbacks += 1

    def get(self, model, item_id):
        del model
        return self.session_file if self.session_file.id == item_id else None


class FakeChatSessionRepository:
    def __init__(self, chat_session: ChatSession) -> None:
        self.chat_session = chat_session

    def get_active_for_user(self, session, *, user_id, chat_session_id, for_update=False):
        del session, for_update
        if self.chat_session.user_id == user_id and self.chat_session.id == chat_session_id:
            return self.chat_session
        return None


class FakeSessionFileRepository:
    def __init__(self, session_file: SessionFile) -> None:
        self.session_file = session_file

    def get_active_for_chat(self, session, *, user_id, chat_session_id, session_file_id):
        del session
        if (
            self.session_file.id == session_file_id
            and self.session_file.user_id == user_id
            and self.session_file.chat_session_id == chat_session_id
            and self.session_file.deleted_at is None
        ):
            return self.session_file
        return None

    def get_active_by_object_key(self, session, *, user_id, object_key):
        del session
        if self.session_file.user_id == user_id and self.session_file.object_key == object_key and self.session_file.deleted_at is None:
            return self.session_file
        return None


class FakeStorage:
    def __init__(self, *, delete_result: bool) -> None:
        self.delete_result = delete_result
        self.deleted_keys: list[str | None] = []

    def delete(self, object_key: str | None) -> bool:
        self.deleted_keys.append(object_key)
        return self.delete_result


def make_service_bundle(*, delete_result: bool = True):
    user = User(id=uuid.uuid4(), username="researcher", password_hash="hash")
    chat_session = ChatSession(id=uuid.uuid4(), user_id=user.id, title="Чат")
    session_file = SessionFile(
        id=uuid.uuid4(),
        chat_session_id=chat_session.id,
        user_id=user.id,
        original_filename="source.txt",
        object_key="session-files/source.txt",
        kind="txt",
        size_bytes=10,
    )
    db_session = DummySession(session_file)
    storage = FakeStorage(delete_result=delete_result)
    service = SessionFileService(
        session=db_session,
        chat_session_repository=FakeChatSessionRepository(chat_session),
        session_file_repository=FakeSessionFileRepository(session_file),
    )
    return service, user, chat_session, session_file, storage, db_session


def test_delete_file_soft_deletes_and_records_storage_deleted() -> None:
    service, user, chat_session, session_file, storage, db_session = make_service_bundle(delete_result=True)

    service.delete_file(
        user=user,
        chat_session_id=chat_session.id,
        session_file_id=session_file.id,
        storage=storage,
    )

    assert session_file.deleted_at is not None
    assert session_file.storage_deleted_at is not None
    assert session_file.storage_delete_error is None
    assert storage.deleted_keys == [session_file.object_key]
    assert db_session.commits == 2
    assert db_session.rollbacks == 0


def test_delete_file_keeps_soft_delete_when_storage_cleanup_fails() -> None:
    service, user, chat_session, session_file, storage, db_session = make_service_bundle(delete_result=False)

    service.delete_file(
        user=user,
        chat_session_id=chat_session.id,
        session_file_id=session_file.id,
        storage=storage,
    )

    assert session_file.deleted_at is not None
    assert session_file.storage_deleted_at is None
    assert session_file.storage_delete_error == "Could not delete file from storage."
    assert storage.deleted_keys == [session_file.object_key]
    assert db_session.commits == 2
    assert db_session.rollbacks == 0


def test_get_downloadable_file_requires_owner_and_active_file() -> None:
    service, user, _, session_file, _, _ = make_service_bundle()

    downloadable = service.get_downloadable_file(user=user, object_key=session_file.object_key)

    assert downloadable.id == session_file.id


def test_get_downloadable_file_rejects_other_user() -> None:
    service, _, _, session_file, _, _ = make_service_bundle()
    other_user = User(id=uuid.uuid4(), username="other", password_hash="hash")

    try:
        service.get_downloadable_file(user=other_user, object_key=session_file.object_key)
    except Exception as exc:
        assert exc.detail == "Session file not found."
    else:
        raise AssertionError("Expected not found for another user")


def test_storage_accepts_pdf_under_upload_limit(tmp_path) -> None:
    storage = SessionFileStorage(uploads_dir=tmp_path, max_bytes=100 * 1024 * 1024)
    upload = FakeUploadFile(
        filename="brief.pdf",
        content=b"%PDF-1.7\n" + (b"x" * (151 * 1024)),
        content_type="application/pdf",
    )

    object_key, size_bytes = asyncio.run(storage.save(chat_session_id=uuid.uuid4(), file=upload))

    assert object_key.endswith(".pdf")
    assert size_bytes == 151 * 1024 + len(b"%PDF-1.7\n")
    assert (tmp_path / object_key).is_file()


def test_storage_rejects_file_over_upload_limit_and_removes_partial_file(tmp_path) -> None:
    storage = SessionFileStorage(uploads_dir=tmp_path, max_bytes=4)
    upload = FakeUploadFile(filename="too-large.txt", content=b"12345", content_type="text/plain")

    try:
        asyncio.run(storage.save(chat_session_id=uuid.uuid4(), file=upload))
    except ValidationError as exc:
        assert exc.detail == "Session file is too large. Maximum size is 4 bytes."
    else:
        raise AssertionError("Expected file size validation error")

    assert list(tmp_path.rglob("*.*")) == []
