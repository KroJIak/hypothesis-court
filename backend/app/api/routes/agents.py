import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps.auth import get_current_user
from app.core.settings import Settings, get_settings
from app.db.session import get_db_session
from app.models.user import User
from app.models.user_agent import UserAgent
from app.repositories.agent_repository import AgentRepository
from app.repositories.model_provider_settings_repository import ModelProviderSettingsRepository
from app.schemas.agent import (
    AgentIconResponse,
    AgentGenerationStatusResponse,
    UserAgentCreateRequest,
    UserAgentGenerateRequest,
    UserAgentResponse,
    UserAgentsListResponse,
    UserAgentUpdateRequest,
)
from app.services.agent_service import AgentService
from app.services.exceptions import ServiceError

router = APIRouter(prefix="/agents", tags=["agents"])


def _get_agent_service(session: Session) -> AgentService:
    return AgentService(
        session=session,
        agent_repository=AgentRepository(),
        model_provider_settings_repository=ModelProviderSettingsRepository(),
    )


def to_user_agent_response(agent: UserAgent) -> UserAgentResponse:
    return UserAgentResponse(
        id=agent.id,
        name=agent.name,
        variant=agent.icon_key or "empty",
        system_prompt=agent.system_prompt,
        is_custom=agent.default_key is None,
        is_empty=False,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
    )


@router.get("/icons", response_model=list[AgentIconResponse])
def list_agent_icons(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> list[AgentIconResponse]:
    del current_user
    service = _get_agent_service(session)
    return [AgentIconResponse.model_validate(icon) for icon in service.list_icons()]


@router.get("", response_model=UserAgentsListResponse)
def list_agents(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> UserAgentsListResponse:
    service = _get_agent_service(session)
    agents = service.list_agents(user=current_user)
    return UserAgentsListResponse(items=[to_user_agent_response(agent) for agent in agents])


@router.get("/generation-status", response_model=AgentGenerationStatusResponse)
def get_agent_generation_status(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> AgentGenerationStatusResponse:
    del current_user
    service = _get_agent_service(session)
    return AgentGenerationStatusResponse(available=service.can_generate_agent_prompt(settings=settings))


@router.post("", response_model=UserAgentResponse, status_code=status.HTTP_201_CREATED)
def create_agent(
    payload: UserAgentCreateRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> UserAgentResponse:
    service = _get_agent_service(session)
    try:
        agent = service.create_agent(
            user=current_user,
            name=payload.name,
            icon_key=payload.variant,
            system_prompt=payload.system_prompt,
            max_agents=settings.user_max_agents,
        )
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    return to_user_agent_response(agent)


@router.patch("/{agent_id}", response_model=UserAgentResponse)
def update_agent(
    agent_id: uuid.UUID,
    payload: UserAgentUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> UserAgentResponse:
    service = _get_agent_service(session)
    try:
        agent = service.update_agent(
            user=current_user,
            agent_id=agent_id,
            name=payload.name,
            icon_key=payload.variant,
            system_prompt=payload.system_prompt,
        )
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    return to_user_agent_response(agent)


@router.post("/{agent_id}/generate", response_model=UserAgentResponse)
def generate_agent(
    agent_id: uuid.UUID,
    payload: UserAgentGenerateRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> UserAgentResponse:
    service = _get_agent_service(session)
    try:
        agent = service.generate_agent(
            user=current_user,
            agent_id=agent_id,
            name=payload.name,
            system_prompt=payload.system_prompt,
            settings=settings,
        )
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    return to_user_agent_response(agent)


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent(
    agent_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> Response:
    service = _get_agent_service(session)
    try:
        service.delete_agent(user=current_user, agent_id=agent_id)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
