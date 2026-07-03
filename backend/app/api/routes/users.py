import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps.auth import CurrentPrincipal, get_current_admin, get_current_user
from app.core.settings import Settings, get_settings
from app.db.session import get_db_session
from app.models.enums import UserStatus
from app.repositories.audit_repository import AuditRepository
from app.repositories.auth_refresh_session_repository import AuthRefreshSessionRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import MessageResponse
from app.schemas.user import (
    AdminPasswordResetRequest,
    SelfPasswordChangeRequest,
    SelfProfileUpdateRequest,
    UserCreateRequest,
    UserResponse,
    UsersListResponse,
    UserUpdateRequest,
)
from app.services.exceptions import ServiceError
from app.services.avatar_storage import AvatarStorage
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])


def _get_user_service(session: Session) -> UserService:
    return UserService(
        session=session,
        user_repository=UserRepository(),
        refresh_session_repository=AuthRefreshSessionRepository(),
        audit_repository=AuditRepository(),
    )


@router.get("/me", response_model=UserResponse)
def read_current_user(user=Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(user)


@router.patch("/me/profile", response_model=UserResponse)
def update_profile(
    payload: SelfProfileUpdateRequest,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> UserResponse:
    service = _get_user_service(session)
    try:
        updated = service.update_profile(
            user=current_user,
            first_name=payload.first_name,
            last_name=payload.last_name,
        )
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    return UserResponse.model_validate(updated)


@router.post("/me/avatar", response_model=UserResponse)
async def update_avatar(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> UserResponse:
    service = _get_user_service(session)
    avatar_storage = AvatarStorage(
        uploads_dir=settings.uploads_dir,
        max_bytes=settings.avatar_upload_max_bytes,
    )
    try:
        updated = await service.update_avatar(
            user=current_user,
            file=file,
            avatar_storage=avatar_storage,
        )
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    return UserResponse.model_validate(updated)


@router.post("/me/change-password", response_model=MessageResponse)
def change_password(
    payload: SelfPasswordChangeRequest,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> MessageResponse:
    service = _get_user_service(session)
    try:
        service.change_password(
            user=current_user,
            old_password=payload.old_password,
            new_password=payload.new_password,
            new_password_repeat=payload.new_password_repeat,
        )
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    return MessageResponse(message="Password changed. Please log in again.")


@router.get("", response_model=UsersListResponse)
def list_users(
    principal: CurrentPrincipal = Depends(get_current_admin),
    search: str | None = Query(default=None),
    is_admin: bool | None = Query(default=None),
    status_filter: UserStatus | None = Query(default=None, alias="status"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    session: Session = Depends(get_db_session),
) -> UsersListResponse:
    del principal
    service = _get_user_service(session)
    items, total = service.list_users(
        search=search,
        is_admin=is_admin,
        status=status_filter,
        limit=limit,
        offset=offset,
    )
    return UsersListResponse(
        items=[UserResponse.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreateRequest,
    principal: CurrentPrincipal = Depends(get_current_admin),
    session: Session = Depends(get_db_session),
) -> UserResponse:
    service = _get_user_service(session)
    try:
        user = service.create_user(
            actor=principal.user,
            username=payload.username,
            password=payload.password,
            is_admin=payload.is_admin,
            first_name=payload.first_name,
            last_name=payload.last_name,
        )
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    return UserResponse.model_validate(user)


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: uuid.UUID,
    principal: CurrentPrincipal = Depends(get_current_admin),
    session: Session = Depends(get_db_session),
) -> UserResponse:
    del principal
    service = _get_user_service(session)
    try:
        user = service.get_user(user_id)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    return UserResponse.model_validate(user)


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: uuid.UUID,
    payload: UserUpdateRequest,
    principal: CurrentPrincipal = Depends(get_current_admin),
    session: Session = Depends(get_db_session),
) -> UserResponse:
    service = _get_user_service(session)
    try:
        user = service.update_user(
            actor=principal.user,
            user_id=user_id,
            first_name=payload.first_name,
            last_name=payload.last_name,
            is_admin=payload.is_admin,
            status=payload.status,
        )
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    return UserResponse.model_validate(user)


@router.post("/{user_id}/reset-password", response_model=MessageResponse)
def reset_password(
    user_id: uuid.UUID,
    payload: AdminPasswordResetRequest,
    principal: CurrentPrincipal = Depends(get_current_admin),
    session: Session = Depends(get_db_session),
) -> MessageResponse:
    service = _get_user_service(session)
    try:
        service.reset_password(
            actor=principal.user,
            user_id=user_id,
            new_password=payload.new_password,
        )
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    return MessageResponse(message="Password reset.")


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: uuid.UUID,
    principal: CurrentPrincipal = Depends(get_current_admin),
    session: Session = Depends(get_db_session),
) -> Response:
    service = _get_user_service(session)
    try:
        service.delete_user(actor=principal.user, user_id=user_id)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
