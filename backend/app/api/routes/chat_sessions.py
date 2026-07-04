import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps.auth import get_current_user
from app.core.settings import Settings, get_settings
from app.db.session import get_db_session
from app.models.user import User
from app.repositories.chat_session_repository import ChatSessionRepository
from app.repositories.agent_repository import AgentRepository
from app.repositories.model_provider_settings_repository import ModelProviderSettingsRepository
from app.schemas.agent import (
    ChatSessionAgentAttachRequest,
    ChatSessionAgentResponse,
    ChatSessionAgentsListResponse,
)
from app.repositories.session_file_repository import SessionFileRepository
from app.schemas.chat_session import (
    ChatSessionCreateRequest,
    ChatSessionRenameRequest,
    ChatSessionResponse,
    ChatSessionsListResponse,
)
from app.schemas.session_file import SessionFileResponse, SessionFilesListResponse
from app.services.chat_session_service import ChatSessionService
from app.services.exceptions import ServiceError
from app.services.agent_service import AgentService
from app.services.session_file_service import SessionFileService
from app.services.session_file_storage import SessionFileStorage

router = APIRouter(prefix="/chat-sessions", tags=["chat-sessions"])


def _get_chat_session_service(session: Session) -> ChatSessionService:
    return ChatSessionService(
        session=session,
        chat_session_repository=ChatSessionRepository(),
    )


def _get_session_file_service(session: Session) -> SessionFileService:
    return SessionFileService(
        session=session,
        chat_session_repository=ChatSessionRepository(),
        session_file_repository=SessionFileRepository(),
    )


def _get_agent_service(session: Session) -> AgentService:
    return AgentService(
        session=session,
        agent_repository=AgentRepository(),
        model_provider_settings_repository=ModelProviderSettingsRepository(),
    )


def _to_selected_agent_response(selected_agent, agent) -> ChatSessionAgentResponse:
    return ChatSessionAgentResponse(
        id=agent.id,
        name=agent.name,
        variant=agent.icon_key or "empty",
        system_prompt=agent.system_prompt,
        is_custom=agent.default_key is None,
        is_empty=False,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
        placement=selected_agent.placement,
        position=selected_agent.position,
    )


@router.get("", response_model=ChatSessionsListResponse)
def list_chat_sessions(
    search: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ChatSessionsListResponse:
    service = _get_chat_session_service(session)
    items, total = service.list_sessions(
        user=current_user,
        search=search,
        limit=limit,
        offset=offset,
    )
    return ChatSessionsListResponse(
        items=[ChatSessionResponse.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
        max_pinned=settings.chat_max_pinned_sessions,
    )


@router.post("", response_model=ChatSessionResponse, status_code=status.HTTP_201_CREATED)
def create_chat_session(
    payload: ChatSessionCreateRequest,
    response: Response,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> ChatSessionResponse:
    service = _get_chat_session_service(session)
    try:
        chat_session, was_created = service.create_session(user=current_user, title=payload.title)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    if not was_created:
        response.status_code = status.HTTP_200_OK
    return ChatSessionResponse.model_validate(chat_session)


@router.patch("/{chat_session_id}", response_model=ChatSessionResponse)
def rename_chat_session(
    chat_session_id: uuid.UUID,
    payload: ChatSessionRenameRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> ChatSessionResponse:
    service = _get_chat_session_service(session)
    try:
        chat_session = service.rename_session(
            user=current_user,
            chat_session_id=chat_session_id,
            title=payload.title,
        )
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    return ChatSessionResponse.model_validate(chat_session)


@router.post("/{chat_session_id}/pin", response_model=ChatSessionResponse)
def pin_chat_session(
    chat_session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ChatSessionResponse:
    service = _get_chat_session_service(session)
    try:
        chat_session = service.pin_session(
            user=current_user,
            chat_session_id=chat_session_id,
            max_pinned_sessions=settings.chat_max_pinned_sessions,
        )
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    return ChatSessionResponse.model_validate(chat_session)


@router.post("/{chat_session_id}/unpin", response_model=ChatSessionResponse)
def unpin_chat_session(
    chat_session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> ChatSessionResponse:
    service = _get_chat_session_service(session)
    try:
        chat_session = service.unpin_session(user=current_user, chat_session_id=chat_session_id)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    return ChatSessionResponse.model_validate(chat_session)


@router.post("/{chat_session_id}/start", response_model=ChatSessionResponse)
def start_chat_session(
    chat_session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> ChatSessionResponse:
    service = _get_chat_session_service(session)
    try:
        chat_session = service.start_session(user=current_user, chat_session_id=chat_session_id)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    return ChatSessionResponse.model_validate(chat_session)


@router.get("/{chat_session_id}/files", response_model=SessionFilesListResponse)
def list_session_files(
    chat_session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> SessionFilesListResponse:
    service = _get_session_file_service(session)
    try:
        files = service.list_files(user=current_user, chat_session_id=chat_session_id)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    return SessionFilesListResponse(
        items=[SessionFileResponse.model_validate(item) for item in files],
        total=len(files),
        max_files=settings.session_max_files,
    )


@router.post("/{chat_session_id}/files", response_model=SessionFileResponse, status_code=status.HTTP_201_CREATED)
async def upload_session_file(
    chat_session_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> SessionFileResponse:
    service = _get_session_file_service(session)
    storage = SessionFileStorage(uploads_dir=settings.uploads_dir)
    try:
        session_file = await service.upload_file(
            user=current_user,
            chat_session_id=chat_session_id,
            file=file,
            storage=storage,
            max_files=settings.session_max_files,
        )
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    return SessionFileResponse.model_validate(session_file)


@router.get("/{chat_session_id}/agents", response_model=ChatSessionAgentsListResponse)
def list_chat_session_agents(
    chat_session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> ChatSessionAgentsListResponse:
    service = _get_agent_service(session)
    try:
        selected_agents = service.list_selected_agents(user=current_user, chat_session_id=chat_session_id)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    return ChatSessionAgentsListResponse(
        items=[
            _to_selected_agent_response(selected_agent, agent)
            for selected_agent, agent in selected_agents
        ],
    )


@router.post("/{chat_session_id}/agents", response_model=ChatSessionAgentsListResponse)
def attach_chat_session_agent(
    chat_session_id: uuid.UUID,
    payload: ChatSessionAgentAttachRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> ChatSessionAgentsListResponse:
    service = _get_agent_service(session)
    try:
        service.attach_agent_to_chat(
            user=current_user,
            chat_session_id=chat_session_id,
            agent_id=payload.agent_id,
            placement=payload.placement,
            position=payload.position,
        )
        selected_agents = service.list_selected_agents(user=current_user, chat_session_id=chat_session_id)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    return ChatSessionAgentsListResponse(
        items=[
            _to_selected_agent_response(selected_agent, agent)
            for selected_agent, agent in selected_agents
        ],
    )


@router.delete("/{chat_session_id}/agents/{agent_id}", response_model=ChatSessionAgentsListResponse)
def detach_chat_session_agent(
    chat_session_id: uuid.UUID,
    agent_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> ChatSessionAgentsListResponse:
    service = _get_agent_service(session)
    try:
        service.detach_agent_from_chat(user=current_user, chat_session_id=chat_session_id, agent_id=agent_id)
        selected_agents = service.list_selected_agents(user=current_user, chat_session_id=chat_session_id)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    return ChatSessionAgentsListResponse(
        items=[
            _to_selected_agent_response(selected_agent, agent)
            for selected_agent, agent in selected_agents
        ],
    )


@router.delete("/{chat_session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chat_session(
    chat_session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> Response:
    service = _get_chat_session_service(session)
    try:
        service.delete_session(user=current_user, chat_session_id=chat_session_id)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
