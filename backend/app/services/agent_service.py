import json
import uuid
from datetime import UTC, datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.settings import Settings
from app.models.agent_icon import AgentIcon
from app.models.chat_session_agent import ChatSessionAgent
from app.models.user import User
from app.models.user_agent import UserAgent
from app.prompts.agent_prompts import (
    AGENT_SYSTEM_PROMPT_GENERATION_PROMPT,
    DEFAULT_AGENT_SYSTEM_PROMPT_TEMPLATE,
)
from app.repositories.agent_repository import AgentRepository
from app.repositories.model_provider_settings_repository import ModelProviderSettingsRepository
from app.services.exceptions import ConflictError, NotFoundError, ValidationError
from app.services.model_provider_settings_service import ModelProviderSettingsService

class AgentService:
    def __init__(
        self,
        session: Session,
        agent_repository: AgentRepository,
        model_provider_settings_repository: ModelProviderSettingsRepository,
    ) -> None:
        self._session = session
        self._agents = agent_repository
        self._model_provider_settings = model_provider_settings_repository

    def list_icons(self) -> list[AgentIcon]:
        return self._agents.list_icons(self._session)

    def list_agents(self, *, user: User) -> list[UserAgent]:
        return self._agents.list_active_agents_for_user(self._session, user_id=user.id)

    def can_generate_agent_prompt(self, *, settings: Settings) -> bool:
        provider_service = ModelProviderSettingsService(
            session=self._session,
            settings_repository=self._model_provider_settings,
        )
        try:
            provider_service.get_model_client(settings)
        except ValidationError:
            return False
        return True

    def create_agent(
        self,
        *,
        user: User,
        name: str | None,
        icon_key: str | None,
        system_prompt: str | None,
        max_agents: int,
    ) -> UserAgent:
        try:
            active_agent_count = self._agents.count_active_agents_for_user(self._session, user_id=user.id)
            if active_agent_count >= max_agents:
                raise ValidationError(f"Only {max_agents} agents can be created.")
            normalized_icon_key = self._normalize_icon_key(icon_key)
            if normalized_icon_key is not None:
                self._ensure_icon_exists(normalized_icon_key)
            agent = self._agents.create_agent(
                self._session,
                UserAgent(
                    user_id=user.id,
                    name=self._normalize_name(name or "Новый эксперт"),
                    icon_key=normalized_icon_key,
                    system_prompt=self._normalize_system_prompt(system_prompt or DEFAULT_AGENT_SYSTEM_PROMPT_TEMPLATE),
                ),
            )
            self._session.commit()
            return agent
        except Exception:
            self._session.rollback()
            raise

    def update_agent(
        self,
        *,
        user: User,
        agent_id: uuid.UUID,
        name: str,
        icon_key: str | None,
        system_prompt: str,
    ) -> UserAgent:
        try:
            agent = self._get_agent(user=user, agent_id=agent_id, for_update=True)
            normalized_icon_key = self._normalize_icon_key(icon_key)
            if normalized_icon_key is not None:
                self._ensure_icon_exists(normalized_icon_key)
            agent.name = self._normalize_name(name)
            agent.icon_key = normalized_icon_key
            agent.system_prompt = self._normalize_system_prompt(system_prompt)
            self._session.commit()
            return agent
        except Exception:
            self._session.rollback()
            raise

    def delete_agent(self, *, user: User, agent_id: uuid.UUID) -> None:
        try:
            agent = self._get_agent(user=user, agent_id=agent_id, for_update=True)
            agent.deleted_at = datetime.now(UTC)
            self._session.commit()
        except Exception:
            self._session.rollback()
            raise

    def generate_agent(
        self,
        *,
        user: User,
        agent_id: uuid.UUID,
        name: str,
        system_prompt: str | None,
        settings: Settings,
    ) -> UserAgent:
        try:
            agent = self._get_agent(user=user, agent_id=agent_id, for_update=True)
            normalized_name = self._normalize_name(name)
            provider_service = ModelProviderSettingsService(
                session=self._session,
                settings_repository=self._model_provider_settings,
            )
            client, model = provider_service.get_model_client(settings)
            icons = self._agents.list_icons(self._session)
            generated = self._generate_agent_payload(
                client=client,
                model=model,
                name=normalized_name,
                current_system_prompt=system_prompt,
                icons=icons,
            )
            icon_key = self._normalize_icon_key(generated.get("icon_key"))
            if icon_key is not None:
                self._ensure_icon_exists(icon_key)
            agent.name = normalized_name
            agent.system_prompt = self._normalize_system_prompt(str(generated["system_prompt"]))
            agent.icon_key = icon_key
            self._session.commit()
            return agent
        except Exception:
            self._session.rollback()
            raise

    def list_selected_agents(self, *, user: User, chat_session_id: uuid.UUID) -> list[tuple[ChatSessionAgent, UserAgent]]:
        self._ensure_chat_session(user=user, chat_session_id=chat_session_id)
        return self._agents.list_selected_agents(
            self._session,
            user_id=user.id,
            chat_session_id=chat_session_id,
        )

    def attach_agent_to_chat(
        self,
        *,
        user: User,
        chat_session_id: uuid.UUID,
        agent_id: uuid.UUID,
        placement: str,
        position: int | None,
    ) -> ChatSessionAgent:
        try:
            self._ensure_chat_session(user=user, chat_session_id=chat_session_id)
            self._get_agent(user=user, agent_id=agent_id)
            existing = self._agents.get_selected_agent(
                self._session,
                user_id=user.id,
                chat_session_id=chat_session_id,
                agent_id=agent_id,
            )
            if existing is not None:
                return existing
            selected_agent = self._agents.create_selected_agent(
                self._session,
                ChatSessionAgent(
                    user_id=user.id,
                    chat_session_id=chat_session_id,
                    agent_id=agent_id,
                    placement=self._normalize_placement(placement),
                    position=position
                    if position is not None
                    else self._agents.get_next_selected_position(self._session, chat_session_id=chat_session_id),
                ),
            )
            self._session.commit()
            return selected_agent
        except IntegrityError as exc:
            self._session.rollback()
            raise ConflictError("Agent is already selected in this chat.") from exc
        except Exception:
            self._session.rollback()
            raise

    def detach_agent_from_chat(self, *, user: User, chat_session_id: uuid.UUID, agent_id: uuid.UUID) -> None:
        try:
            self._ensure_chat_session(user=user, chat_session_id=chat_session_id)
            selected_agent = self._agents.get_selected_agent(
                self._session,
                user_id=user.id,
                chat_session_id=chat_session_id,
                agent_id=agent_id,
            )
            if selected_agent is None:
                raise NotFoundError("Selected agent not found.")
            self._agents.delete_selected_agent(self._session, selected_agent)
            self._session.commit()
        except Exception:
            self._session.rollback()
            raise

    def _get_agent(self, *, user: User, agent_id: uuid.UUID, for_update: bool = False) -> UserAgent:
        agent = self._agents.get_active_agent_for_user(
            self._session,
            user_id=user.id,
            agent_id=agent_id,
            for_update=for_update,
        )
        if agent is None:
            raise NotFoundError("Agent not found.")
        return agent

    def _ensure_chat_session(self, *, user: User, chat_session_id: uuid.UUID) -> None:
        chat_session = self._agents.get_active_chat_session_for_user(
            self._session,
            user_id=user.id,
            chat_session_id=chat_session_id,
        )
        if chat_session is None:
            raise NotFoundError("Chat session not found.")

    def _ensure_icon_exists(self, icon_key: str) -> None:
        if self._agents.get_icon(self._session, icon_key) is None:
            raise ValidationError("Unknown agent icon.")

    def _generate_agent_payload(
        self,
        *,
        client,
        model: str,
        name: str,
        current_system_prompt: str | None,
        icons: list[AgentIcon],
    ) -> dict[str, str]:
        icon_options = "\n".join(f"- {icon.icon_key}: {icon.label}" for icon in icons)
        content = client.create_chat_completion(
            model=model,
            messages=[
                {"role": "system", "content": AGENT_SYSTEM_PROMPT_GENERATION_PROMPT},
                {
                    "role": "user",
                    "content": "\n".join(
                        [
                            f"Название агента: {name}",
                            f"Текущий черновик промпта: {current_system_prompt or 'не задан'}",
                            "Разрешённые icon_key:",
                            icon_options,
                        ],
                    ),
                },
            ],
        )
        try:
            payload = json.loads(content)
        except json.JSONDecodeError as exc:
            raise ValidationError("Provider returned invalid agent configuration.") from exc
        if not isinstance(payload, dict) or not isinstance(payload.get("system_prompt"), str):
            raise ValidationError("Provider returned invalid agent configuration.")
        if not isinstance(payload.get("icon_key"), str):
            raise ValidationError("Provider returned invalid agent configuration.")
        return payload

    @staticmethod
    def _normalize_name(name: str) -> str:
        normalized = name.strip()
        if not normalized:
            raise ValidationError("Agent name cannot be empty.")
        if len(normalized) > 100:
            raise ValidationError("Agent name must contain at most 100 characters.")
        return normalized

    @staticmethod
    def _normalize_system_prompt(system_prompt: str) -> str:
        normalized = system_prompt.strip()
        if len(normalized) > 8000:
            raise ValidationError("Agent system prompt must contain at most 8000 characters.")
        return normalized

    @staticmethod
    def _normalize_icon_key(icon_key: str | None) -> str | None:
        if icon_key is None:
            return None
        normalized = icon_key.strip()
        return normalized or None

    @staticmethod
    def _normalize_placement(placement: str) -> str:
        normalized = placement.strip()
        if normalized not in {"left", "right"}:
            raise ValidationError("Agent placement is invalid.")
        return normalized
