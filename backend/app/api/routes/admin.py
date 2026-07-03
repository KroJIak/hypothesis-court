from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps.auth import CurrentPrincipal, get_current_admin
from app.db.session import get_db_session
from app.repositories.model_provider_settings_repository import ModelProviderSettingsRepository
from app.schemas.model_provider_settings import (
    ModelProviderSettingsResponse,
    ModelProviderSettingsUpdateRequest,
)
from app.services.exceptions import ServiceError
from app.services.model_provider_settings_service import ModelProviderSettingsService

router = APIRouter(prefix="/admin", tags=["admin"])


def _get_model_provider_settings_service(session: Session) -> ModelProviderSettingsService:
    return ModelProviderSettingsService(
        session=session,
        settings_repository=ModelProviderSettingsRepository(),
    )


def _to_response(settings) -> ModelProviderSettingsResponse:
    return ModelProviderSettingsResponse(
        provider=settings.provider,
        base_url=settings.base_url,
        has_api_token=bool(settings.api_token),
        updated_at=settings.updated_at,
    )


@router.get("/model-providers/openai", response_model=ModelProviderSettingsResponse)
def get_openai_model_provider_settings(
    principal: CurrentPrincipal = Depends(get_current_admin),
    session: Session = Depends(get_db_session),
) -> ModelProviderSettingsResponse:
    del principal
    service = _get_model_provider_settings_service(session)
    settings = service.get_openai_settings()
    if settings is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model provider settings not found.")
    return _to_response(settings)


@router.put("/model-providers/openai", response_model=ModelProviderSettingsResponse)
def update_openai_model_provider_settings(
    payload: ModelProviderSettingsUpdateRequest,
    principal: CurrentPrincipal = Depends(get_current_admin),
    session: Session = Depends(get_db_session),
) -> ModelProviderSettingsResponse:
    service = _get_model_provider_settings_service(session)
    try:
        settings = service.upsert_openai_settings(
            actor=principal.user,
            base_url=payload.base_url,
            api_token=payload.api_token,
        )
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    return _to_response(settings)
