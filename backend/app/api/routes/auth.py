from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps.auth import CurrentPrincipal, get_current_principal
from app.core.settings import Settings, get_settings
from app.db.session import get_db_session
from app.repositories.audit_repository import AuditRepository
from app.repositories.auth_refresh_session_repository import AuthRefreshSessionRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import AuthTokensResponse, LoginRequest, MessageResponse, RefreshRequest
from app.schemas.user import UserResponse
from app.services.auth_service import AuthResult, AuthService
from app.services.exceptions import ServiceError

router = APIRouter(prefix="/auth", tags=["auth"])


def _build_auth_response(result: AuthResult, settings: Settings) -> AuthTokensResponse:
    return AuthTokensResponse(
        access_token=result.access_token,
        refresh_token=result.refresh_token,
        access_token_expires_in=int(settings.auth_access_token_ttl.total_seconds()),
        refresh_token_expires_in=int(settings.auth_refresh_token_ttl.total_seconds()),
        user=UserResponse.model_validate(result.user),
    )


def _get_auth_service(session: Session, settings: Settings) -> AuthService:
    return AuthService(
        session=session,
        settings=settings,
        user_repository=UserRepository(),
        refresh_session_repository=AuthRefreshSessionRepository(),
        audit_repository=AuditRepository(),
    )


@router.post("/login", response_model=AuthTokensResponse)
def login(
    payload: LoginRequest,
    request: Request,
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> AuthTokensResponse:
    service = _get_auth_service(session, settings)
    try:
        result = service.login(
            username=payload.username,
            password=payload.password,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    return _build_auth_response(result, settings)


@router.post("/refresh", response_model=AuthTokensResponse)
def refresh(
    payload: RefreshRequest,
    request: Request,
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> AuthTokensResponse:
    service = _get_auth_service(session, settings)
    try:
        result = service.refresh(
            refresh_token=payload.refresh_token,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    return _build_auth_response(result, settings)


@router.post("/logout", response_model=MessageResponse)
def logout(
    principal: CurrentPrincipal = Depends(get_current_principal),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> MessageResponse:
    service = _get_auth_service(session, settings)
    service.logout(user=principal.user, session_id=principal.token.session_id)
    return MessageResponse(message="Logged out.")


@router.post("/logout-all", response_model=MessageResponse)
def logout_all(
    principal: CurrentPrincipal = Depends(get_current_principal),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> MessageResponse:
    service = _get_auth_service(session, settings)
    service.logout_all(user=principal.user)
    return MessageResponse(message="All sessions were revoked.")


@router.get("/me", response_model=UserResponse)
def read_me(principal: CurrentPrincipal = Depends(get_current_principal)) -> UserResponse:
    return UserResponse.model_validate(principal.user)
