import uuid

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.models.chat_session import ChatSession


class ChatSessionRepository:
    def get_active_for_user(
        self,
        session: Session,
        *,
        user_id: uuid.UUID,
        chat_session_id: uuid.UUID,
    ) -> ChatSession | None:
        stmt = select(ChatSession).where(
            ChatSession.id == chat_session_id,
            ChatSession.user_id == user_id,
            ChatSession.deleted_at.is_(None),
        )
        return session.execute(stmt).scalar_one_or_none()

    def list_active_for_user(
        self,
        session: Session,
        *,
        user_id: uuid.UUID,
        search: str | None,
        limit: int,
        offset: int,
    ) -> tuple[list[ChatSession], int]:
        stmt: Select[tuple[ChatSession]] = select(ChatSession).where(
            ChatSession.user_id == user_id,
            ChatSession.deleted_at.is_(None),
        )

        if search:
            stmt = stmt.where(ChatSession.title.ilike(f"%{search}%"))

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = session.execute(count_stmt).scalar_one()
        items = session.execute(
            stmt.order_by(
                ChatSession.is_pinned.desc(),
                ChatSession.pinned_at.desc().nullslast(),
                ChatSession.updated_at.desc(),
                ChatSession.created_at.desc(),
            )
            .offset(offset)
            .limit(limit)
        ).scalars().all()
        return items, total

    def count_pinned_for_user(self, session: Session, *, user_id: uuid.UUID) -> int:
        stmt = select(func.count()).select_from(ChatSession).where(
            ChatSession.user_id == user_id,
            ChatSession.deleted_at.is_(None),
            ChatSession.is_pinned.is_(True),
        )
        return session.execute(stmt).scalar_one()

    def create(self, session: Session, chat_session: ChatSession) -> ChatSession:
        session.add(chat_session)
        session.flush()
        return chat_session
