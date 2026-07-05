import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models.chat_session import ChatSession
from app.models.user import User
from app.repositories.chat_session_repository import ChatSessionRepository
from app.schemas.chat_session import ChatSessionDraftInput
from app.services.exceptions import ConflictError, NotFoundError, ValidationError


class ChatSessionService:
    def __init__(
        self,
        session: Session,
        chat_session_repository: ChatSessionRepository,
    ) -> None:
        self._session = session
        self._chat_sessions = chat_session_repository

    def list_sessions(
        self,
        *,
        user: User,
        search: str | None,
        limit: int,
        offset: int,
    ) -> tuple[list[ChatSession], int]:
        normalized_search = search.strip() if search else None
        return self._chat_sessions.list_active_for_user(
            self._session,
            user_id=user.id,
            search=normalized_search,
            limit=limit,
            offset=offset,
        )

    def create_session(self, *, user: User, title: str) -> tuple[ChatSession, bool]:
        try:
            unstarted_session = self._chat_sessions.get_empty_unstarted_for_user(self._session, user_id=user.id)
            if unstarted_session is not None:
                return unstarted_session, False

            chat_session = self._chat_sessions.create(
                self._session,
                ChatSession(
                    user_id=user.id,
                    title=self._normalize_title(title),
                    draft_inputs=[],
                ),
            )
            self._session.commit()
            return chat_session, True
        except Exception:
            self._session.rollback()
            raise

    def rename_session(self, *, user: User, chat_session_id: uuid.UUID, title: str) -> ChatSession:
        try:
            chat_session = self._get_owned_session(user=user, chat_session_id=chat_session_id)
            chat_session.title = self._normalize_title(title)
            self._session.commit()
            return chat_session
        except Exception:
            self._session.rollback()
            raise

    def pin_session(
        self,
        *,
        user: User,
        chat_session_id: uuid.UUID,
        max_pinned_sessions: int,
    ) -> ChatSession:
        try:
            chat_session = self._get_owned_session(user=user, chat_session_id=chat_session_id)
            if chat_session.is_pinned:
                return chat_session

            pinned_count = self._chat_sessions.count_pinned_for_user(self._session, user_id=user.id)
            if pinned_count >= max_pinned_sessions:
                raise ValidationError(f"Only {max_pinned_sessions} chats can be pinned.")

            chat_session.is_pinned = True
            chat_session.pinned_at = datetime.now(UTC)
            self._session.commit()
            return chat_session
        except Exception:
            self._session.rollback()
            raise

    def unpin_session(self, *, user: User, chat_session_id: uuid.UUID) -> ChatSession:
        try:
            chat_session = self._get_owned_session(user=user, chat_session_id=chat_session_id)
            chat_session.is_pinned = False
            chat_session.pinned_at = None
            self._session.commit()
            return chat_session
        except Exception:
            self._session.rollback()
            raise

    def start_session(self, *, user: User, chat_session_id: uuid.UUID) -> ChatSession:
        try:
            chat_session = self._get_owned_session(user=user, chat_session_id=chat_session_id)
            chat_session.is_started = True
            chat_session.draft_inputs = []
            self._session.commit()
            return chat_session
        except Exception:
            self._session.rollback()
            raise

    def update_draft_inputs(
        self,
        *,
        user: User,
        chat_session_id: uuid.UUID,
        inputs: list[ChatSessionDraftInput],
    ) -> ChatSession:
        try:
            chat_session = self._get_owned_session(user=user, chat_session_id=chat_session_id)
            normalized_inputs = self._normalize_draft_inputs(inputs)
            if chat_session.is_started and normalized_inputs:
                raise ConflictError("Нельзя сохранять черновик входных данных после старта чата.")
            chat_session.draft_inputs = normalized_inputs
            self._session.commit()
            return chat_session
        except Exception:
            self._session.rollback()
            raise

    def delete_session(self, *, user: User, chat_session_id: uuid.UUID) -> None:
        try:
            chat_session = self._get_owned_session(user=user, chat_session_id=chat_session_id)
            chat_session.is_pinned = False
            chat_session.pinned_at = None
            chat_session.deleted_at = datetime.now(UTC)
            self._session.commit()
        except Exception:
            self._session.rollback()
            raise

    def _get_owned_session(self, *, user: User, chat_session_id: uuid.UUID) -> ChatSession:
        chat_session = self._chat_sessions.get_active_for_user(
            self._session,
            user_id=user.id,
            chat_session_id=chat_session_id,
        )
        if chat_session is None:
            raise NotFoundError("Chat session not found.")
        return chat_session

    @staticmethod
    def _normalize_title(title: str) -> str:
        normalized = title.strip()
        if not normalized:
            raise ValidationError("Chat title cannot be empty.")
        if len(normalized) > 200:
            raise ValidationError("Chat title must contain at most 200 characters.")
        return normalized

    @staticmethod
    def _normalize_draft_inputs(inputs: list[ChatSessionDraftInput]) -> list[dict[str, str]]:
        if len(inputs) > 20:
            raise ValidationError("Можно сохранить не больше 20 входных полей.")

        normalized_inputs: list[dict[str, str]] = []
        for item in inputs:
            label = item.label.strip()
            text = item.text.strip()
            if not label:
                raise ValidationError("Название поля ввода не может быть пустым.")
            if len(label) > 64:
                raise ValidationError("Название поля ввода должно быть не длиннее 64 символов.")
            if not text:
                raise ValidationError("Текст поля ввода не может быть пустым.")
            if len(text) > 4000:
                raise ValidationError("Текст одного поля ввода должен быть не длиннее 4000 символов.")
            normalized_inputs.append(
                {
                    "kind": item.kind.value,
                    "label": label,
                    "text": text,
                }
            )

        return normalized_inputs
