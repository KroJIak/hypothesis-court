import uuid
from datetime import UTC, datetime

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.models.chat_session import ChatSession
from app.models.session_file import SessionFile
from app.models.user import User
from app.repositories.chat_session_repository import ChatSessionRepository
from app.repositories.session_file_repository import SessionFileRepository
from app.services.exceptions import NotFoundError, ValidationError
from app.services.session_file_storage import SessionFileStorage


class SessionFileService:
    def __init__(
        self,
        session: Session,
        chat_session_repository: ChatSessionRepository,
        session_file_repository: SessionFileRepository,
    ) -> None:
        self._session = session
        self._chat_sessions = chat_session_repository
        self._session_files = session_file_repository

    def list_files(self, *, user: User, chat_session_id: uuid.UUID) -> list[SessionFile]:
        self._get_owned_session(user=user, chat_session_id=chat_session_id)
        return self._session_files.list_active_for_chat(
            self._session,
            user_id=user.id,
            chat_session_id=chat_session_id,
        )

    def get_downloadable_file(self, *, user: User, object_key: str) -> SessionFile:
        normalized_key = object_key.strip().lstrip("/")
        if not normalized_key or ".." in normalized_key.split("/"):
            raise NotFoundError("Session file not found.")
        session_file = self._session_files.get_active_by_object_key(
            self._session,
            user_id=user.id,
            object_key=normalized_key,
        )
        if session_file is None:
            raise NotFoundError("Session file not found.")
        return session_file

    async def upload_file(
        self,
        *,
        user: User,
        chat_session_id: uuid.UUID,
        file: UploadFile,
        storage: SessionFileStorage,
        max_files: int,
    ) -> SessionFile:
        object_key: str | None = None
        try:
            chat_session = self._get_owned_session(
                user=user,
                chat_session_id=chat_session_id,
                for_update=True,
            )
            active_files_count = self._session_files.count_active_for_chat(
                self._session,
                user_id=user.id,
                chat_session_id=chat_session_id,
            )
            if active_files_count >= max_files:
                raise ValidationError(f"Only {max_files} files can be attached to a chat.")

            filename = storage.normalize_filename(file.filename)
            kind = storage.detect_kind(filename)
            object_key, size_bytes = await storage.save(chat_session_id=chat_session_id, file=file)

            session_file = self._session_files.create(
                self._session,
                SessionFile(
                    chat_session_id=chat_session.id,
                    user_id=user.id,
                    original_filename=filename,
                    object_key=object_key,
                    content_type=self._normalize_content_type(file.content_type),
                    kind=kind,
                    size_bytes=size_bytes,
                ),
            )
            self._session.commit()
            return session_file
        except Exception:
            self._session.rollback()
            storage.delete(object_key)
            raise

    def delete_file(
        self,
        *,
        user: User,
        chat_session_id: uuid.UUID,
        session_file_id: uuid.UUID,
        storage: SessionFileStorage,
    ) -> None:
        try:
            self._get_owned_session(user=user, chat_session_id=chat_session_id)
            session_file = self._session_files.get_active_for_chat(
                self._session,
                user_id=user.id,
                chat_session_id=chat_session_id,
                session_file_id=session_file_id,
            )
            if session_file is None:
                raise NotFoundError("Session file not found.")
            session_file.deleted_at = datetime.now(UTC)
            session_file.storage_deleted_at = None
            session_file.storage_delete_error = None
            object_key = session_file.object_key
            self._session.commit()
        except Exception:
            self._session.rollback()
            raise

        if not storage.delete(object_key):
            self._record_storage_delete_error(
                session_file_id=session_file_id,
                error_message="Could not delete file from storage.",
            )
            return

        self._record_storage_deleted(session_file_id=session_file_id)

    def _record_storage_deleted(self, *, session_file_id: uuid.UUID) -> None:
        try:
            session_file = self._session.get(SessionFile, session_file_id)
            if session_file is None:
                return
            session_file.storage_deleted_at = datetime.now(UTC)
            session_file.storage_delete_error = None
            self._session.commit()
        except Exception:
            self._session.rollback()

    def _record_storage_delete_error(self, *, session_file_id: uuid.UUID, error_message: str) -> None:
        try:
            session_file = self._session.get(SessionFile, session_file_id)
            if session_file is None:
                return
            session_file.storage_delete_error = error_message[:500]
            self._session.commit()
        except Exception:
            self._session.rollback()

    def _get_owned_session(
        self,
        *,
        user: User,
        chat_session_id: uuid.UUID,
        for_update: bool = False,
    ) -> ChatSession:
        chat_session = self._chat_sessions.get_active_for_user(
            self._session,
            user_id=user.id,
            chat_session_id=chat_session_id,
            for_update=for_update,
        )
        if chat_session is None:
            raise NotFoundError("Chat session not found.")
        return chat_session

    @staticmethod
    def _normalize_content_type(content_type: str | None) -> str | None:
        normalized = (content_type or "").strip()
        if not normalized:
            return None
        if len(normalized) > 255:
            raise ValidationError("File content type is too long.")
        return normalized
