import uuid

from sqlalchemy import Select, exists, func, or_, select
from sqlalchemy.orm import Session

from app.models.chat_session import ChatSession
from app.models.chat_session_agent import ChatSessionAgent
from app.models.evidence_item import EvidenceItem
from app.models.hypothesis_candidate import HypothesisCandidate
from app.models.research_input_item import ResearchInputItem
from app.models.research_run import ResearchRun
from app.models.session_file import SessionFile


class ChatSessionRepository:
    def get_active_for_user(
        self,
        session: Session,
        *,
        user_id: uuid.UUID,
        chat_session_id: uuid.UUID,
        for_update: bool = False,
    ) -> ChatSession | None:
        stmt = select(ChatSession).where(
            ChatSession.id == chat_session_id,
            ChatSession.user_id == user_id,
            ChatSession.deleted_at.is_(None),
        )
        if for_update:
            stmt = stmt.with_for_update()
        return session.execute(stmt).scalar_one_or_none()

    def get_empty_unstarted_for_user(self, session: Session, *, user_id: uuid.UUID) -> ChatSession | None:
        selected_agent_exists = exists().where(ChatSessionAgent.chat_session_id == ChatSession.id)
        session_file_exists = exists().where(
            SessionFile.chat_session_id == ChatSession.id,
            SessionFile.deleted_at.is_(None),
        )
        stmt = (
            select(ChatSession)
            .where(
                ChatSession.user_id == user_id,
                ChatSession.deleted_at.is_(None),
                ChatSession.is_started.is_(False),
                ~selected_agent_exists,
                ~session_file_exists,
            )
            .order_by(ChatSession.created_at.desc())
            .limit(1)
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
            pattern = f"%{search}%"
            content_chat_ids = (
                select(ResearchRun.chat_session_id)
                .outerjoin(ResearchInputItem, ResearchInputItem.run_id == ResearchRun.id)
                .outerjoin(HypothesisCandidate, HypothesisCandidate.run_id == ResearchRun.id)
                .outerjoin(EvidenceItem, EvidenceItem.run_id == ResearchRun.id)
                .where(
                    ResearchRun.user_id == user_id,
                    or_(
                        ResearchRun.title.ilike(pattern),
                        ResearchInputItem.text.ilike(pattern),
                        HypothesisCandidate.statement.ilike(pattern),
                        EvidenceItem.summary.ilike(pattern),
                    ),
                )
            )
            stmt = stmt.where(
                or_(
                    ChatSession.title.ilike(pattern),
                    ChatSession.id.in_(content_chat_ids),
                )
            )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = session.execute(count_stmt).scalar_one()
        items = session.execute(
            stmt.order_by(
                ChatSession.is_pinned.desc(),
                ChatSession.is_started.asc(),
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
