import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps.auth import get_current_user
from app.core.settings import Settings, get_settings
from app.db.session import get_db_session
from app.models.user import User
from app.repositories.chat_session_repository import ChatSessionRepository
from app.schemas.chat_session import (
    ChatSessionCreateRequest,
    ChatSessionRenameRequest,
    ChatSessionResponse,
    ChatSessionsListResponse,
)
from app.services.chat_session_service import ChatSessionService
from app.services.exceptions import ServiceError

router = APIRouter(prefix="/chat-sessions", tags=["chat-sessions"])


def _get_chat_session_service(session: Session) -> ChatSessionService:
    return ChatSessionService(
        session=session,
        chat_session_repository=ChatSessionRepository(),
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
