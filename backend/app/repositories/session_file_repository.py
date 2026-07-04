import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.session_file import SessionFile


class SessionFileRepository:
    def list_active_for_chat(
        self,
        session: Session,
        *,
        user_id: uuid.UUID,
        chat_session_id: uuid.UUID,
    ) -> list[SessionFile]:
        stmt = (
            select(SessionFile)
            .where(
                SessionFile.user_id == user_id,
                SessionFile.chat_session_id == chat_session_id,
                SessionFile.deleted_at.is_(None),
            )
            .order_by(SessionFile.created_at.asc(), SessionFile.id.asc())
        )
        return session.execute(stmt).scalars().all()

    def get_active_for_chat(
        self,
        session: Session,
        *,
        user_id: uuid.UUID,
        chat_session_id: uuid.UUID,
        session_file_id: uuid.UUID,
    ) -> SessionFile | None:
        stmt = select(SessionFile).where(
            SessionFile.id == session_file_id,
            SessionFile.user_id == user_id,
            SessionFile.chat_session_id == chat_session_id,
            SessionFile.deleted_at.is_(None),
        )
        return session.execute(stmt).scalar_one_or_none()

    def count_active_for_chat(
        self,
        session: Session,
        *,
        user_id: uuid.UUID,
        chat_session_id: uuid.UUID,
    ) -> int:
        stmt = select(func.count()).select_from(SessionFile).where(
            SessionFile.user_id == user_id,
            SessionFile.chat_session_id == chat_session_id,
            SessionFile.deleted_at.is_(None),
        )
        return session.execute(stmt).scalar_one()

    def create(self, session: Session, session_file: SessionFile) -> SessionFile:
        session.add(session_file)
        session.flush()
        return session_file
