import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models.chat_session import ChatSession
from app.models.user import User
from app.repositories.chat_session_repository import ChatSessionRepository
from app.services.exceptions import NotFoundError, ValidationError


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

    def create_session(self, *, user: User, title: str) -> ChatSession:
        try:
            chat_session = self._chat_sessions.create(
                self._session,
                ChatSession(
                    user_id=user.id,
                    title=self._normalize_title(title),
                ),
            )
            self._session.commit()
            return chat_session
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
