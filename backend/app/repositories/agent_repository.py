import uuid

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.models.agent_icon import AgentIcon
from app.models.chat_session import ChatSession
from app.models.chat_session_agent import ChatSessionAgent
from app.models.user_agent import UserAgent


class AgentRepository:
    def list_icons(self, session: Session) -> list[AgentIcon]:
        stmt = select(AgentIcon).order_by(AgentIcon.sort_order.asc(), AgentIcon.icon_key.asc())
        return session.execute(stmt).scalars().all()

    def get_icon(self, session: Session, icon_key: str) -> AgentIcon | None:
        return session.get(AgentIcon, icon_key)

    def list_active_agents_for_user(self, session: Session, *, user_id: uuid.UUID) -> list[UserAgent]:
        stmt = (
            select(UserAgent)
            .where(UserAgent.user_id == user_id, UserAgent.deleted_at.is_(None))
            .order_by(
                UserAgent.default_key.is_(None).desc(),
                UserAgent.created_at.desc(),
                UserAgent.name.asc(),
            )
        )
        return session.execute(stmt).scalars().all()

    def count_active_agents_for_user(self, session: Session, *, user_id: uuid.UUID) -> int:
        stmt = select(func.count()).select_from(UserAgent).where(
            UserAgent.user_id == user_id,
            UserAgent.deleted_at.is_(None),
        )
        return session.execute(stmt).scalar_one()

    def get_active_agent_for_user(
        self,
        session: Session,
        *,
        user_id: uuid.UUID,
        agent_id: uuid.UUID,
        for_update: bool = False,
    ) -> UserAgent | None:
        stmt: Select[tuple[UserAgent]] = select(UserAgent).where(
            UserAgent.id == agent_id,
            UserAgent.user_id == user_id,
            UserAgent.deleted_at.is_(None),
        )
        if for_update:
            stmt = stmt.with_for_update()
        return session.execute(stmt).scalar_one_or_none()

    def get_agent_by_default_key(
        self,
        session: Session,
        *,
        user_id: uuid.UUID,
        default_key: str,
    ) -> UserAgent | None:
        stmt = select(UserAgent).where(
            UserAgent.user_id == user_id,
            UserAgent.default_key == default_key,
        )
        return session.execute(stmt).scalar_one_or_none()

    def create_agent(self, session: Session, agent: UserAgent) -> UserAgent:
        session.add(agent)
        session.flush()
        return agent

    def get_active_chat_session_for_user(
        self,
        session: Session,
        *,
        user_id: uuid.UUID,
        chat_session_id: uuid.UUID,
        for_update: bool = False,
    ) -> ChatSession | None:
        stmt: Select[tuple[ChatSession]] = select(ChatSession).where(
            ChatSession.id == chat_session_id,
            ChatSession.user_id == user_id,
            ChatSession.deleted_at.is_(None),
        )
        if for_update:
            stmt = stmt.with_for_update()
        return session.execute(stmt).scalar_one_or_none()

    def list_selected_agents(
        self,
        session: Session,
        *,
        user_id: uuid.UUID,
        chat_session_id: uuid.UUID,
    ) -> list[tuple[ChatSessionAgent, UserAgent]]:
        stmt = (
            select(ChatSessionAgent, UserAgent)
            .join(UserAgent, UserAgent.id == ChatSessionAgent.agent_id)
            .where(
                ChatSessionAgent.user_id == user_id,
                ChatSessionAgent.chat_session_id == chat_session_id,
            )
            .order_by(ChatSessionAgent.position.asc(), ChatSessionAgent.created_at.asc())
        )
        return list(session.execute(stmt).all())

    def get_selected_agent(
        self,
        session: Session,
        *,
        user_id: uuid.UUID,
        chat_session_id: uuid.UUID,
        agent_id: uuid.UUID,
    ) -> ChatSessionAgent | None:
        stmt = select(ChatSessionAgent).where(
            ChatSessionAgent.user_id == user_id,
            ChatSessionAgent.chat_session_id == chat_session_id,
            ChatSessionAgent.agent_id == agent_id,
        )
        return session.execute(stmt).scalar_one_or_none()

    def create_selected_agent(self, session: Session, selected_agent: ChatSessionAgent) -> ChatSessionAgent:
        session.add(selected_agent)
        session.flush()
        return selected_agent

    def get_next_selected_position(
        self,
        session: Session,
        *,
        chat_session_id: uuid.UUID,
    ) -> int:
        stmt = select(func.coalesce(func.max(ChatSessionAgent.position), -1) + 1).where(
            ChatSessionAgent.chat_session_id == chat_session_id,
        )
        return int(session.execute(stmt).scalar_one())

    def delete_selected_agent(self, session: Session, selected_agent: ChatSessionAgent) -> None:
        session.delete(selected_agent)
        session.flush()
