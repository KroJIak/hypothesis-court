from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps.auth import CurrentPrincipal, get_current_admin
from app.core.settings import Settings, get_settings
from app.db.session import get_db_session
from app.repositories.model_provider_settings_repository import ModelProviderSettingsRepository
from app.schemas.model_provider_settings import (
    ModelProviderConnectionTestRequest,
    ModelProviderConnectionTestResponse,
    ModelProviderModelsRequest,
    ModelProviderModelsResponse,
    ModelProviderSettingsResponse,
    ModelProviderSettingsUpdateRequest,
)
from app.services.exceptions import ServiceError
from app.services.model_provider_settings_service import (
    EMBEDDING_PROVIDER,
    OPENAI_PROVIDER,
    ModelProviderSettingsService,
)

router = APIRouter(prefix="/admin", tags=["admin"])


def _get_model_provider_settings_service(session: Session) -> ModelProviderSettingsService:
    return ModelProviderSettingsService(
        session=session,
        settings_repository=ModelProviderSettingsRepository(),
    )


def _to_response(settings, *, has_api_token: bool | None = None) -> ModelProviderSettingsResponse:
    return ModelProviderSettingsResponse(
        provider=settings.provider,
        base_url=settings.base_url,
        model=settings.model,
        has_api_token=bool(settings.api_token) if has_api_token is None else has_api_token,
        updated_at=settings.updated_at,
    )


def _get_provider_settings_response(
    *,
    provider: str,
    session: Session,
    settings: Settings,
) -> ModelProviderSettingsResponse:
    service = _get_model_provider_settings_service(session)
    stored_settings = (
        service.get_model_settings(settings)
        if provider == OPENAI_PROVIDER
        else service.get_embedding_settings(settings)
    )
    if stored_settings is None:
        stored_settings = service.get_default_settings(provider, settings)
    has_api_token = bool(stored_settings.api_token)
    if provider == EMBEDDING_PROVIDER:
        has_api_token = has_api_token or bool(settings.embedding_api_key)
    if provider == OPENAI_PROVIDER:
        has_api_token = has_api_token or bool(settings.model_provider_api_key)
    return _to_response(stored_settings, has_api_token=has_api_token)


def _update_provider_settings_response(
    *,
    provider: str,
    payload: ModelProviderSettingsUpdateRequest,
    principal: CurrentPrincipal,
    session: Session,
    app_settings: Settings,
) -> ModelProviderSettingsResponse:
    service = _get_model_provider_settings_service(session)
    settings = service.upsert_provider_settings(
        actor=principal.user,
        provider=provider,
        base_url=payload.base_url,
        model=payload.model,
        api_token=payload.api_token,
    )
    has_api_token = bool(settings.api_token)
    if provider == EMBEDDING_PROVIDER:
        has_api_token = has_api_token or bool(app_settings.embedding_api_key)
    if provider == OPENAI_PROVIDER:
        has_api_token = has_api_token or bool(app_settings.model_provider_api_key)
    return _to_response(settings, has_api_token=has_api_token)


@router.get("/model-providers/openai", response_model=ModelProviderSettingsResponse)
def get_openai_model_provider_settings(
    principal: CurrentPrincipal = Depends(get_current_admin),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ModelProviderSettingsResponse:
    del principal
    return _get_provider_settings_response(provider=OPENAI_PROVIDER, session=session, settings=settings)


@router.put("/model-providers/openai", response_model=ModelProviderSettingsResponse)
def update_openai_model_provider_settings(
    payload: ModelProviderSettingsUpdateRequest,
    principal: CurrentPrincipal = Depends(get_current_admin),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ModelProviderSettingsResponse:
    try:
        return _update_provider_settings_response(
            provider=OPENAI_PROVIDER,
            payload=payload,
            principal=principal,
            session=session,
            app_settings=settings,
        )
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.get("/model-providers/embedding", response_model=ModelProviderSettingsResponse)
def get_embedding_model_provider_settings(
    principal: CurrentPrincipal = Depends(get_current_admin),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ModelProviderSettingsResponse:
    del principal
    return _get_provider_settings_response(provider=EMBEDDING_PROVIDER, session=session, settings=settings)


@router.put("/model-providers/embedding", response_model=ModelProviderSettingsResponse)
def update_embedding_model_provider_settings(
    payload: ModelProviderSettingsUpdateRequest,
    principal: CurrentPrincipal = Depends(get_current_admin),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ModelProviderSettingsResponse:
    try:
        return _update_provider_settings_response(
            provider=EMBEDDING_PROVIDER,
            payload=payload,
            principal=principal,
            session=session,
            app_settings=settings,
        )
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


def _list_provider_models_response(
    *,
    provider: str,
    payload: ModelProviderModelsRequest,
    session: Session,
    settings: Settings,
) -> ModelProviderModelsResponse:
    service = _get_model_provider_settings_service(session)
    models = service.list_provider_models(
        provider=provider,
        base_url=payload.base_url,
        api_token=payload.api_token,
        settings=settings,
    )
    return ModelProviderModelsResponse(models=models)


def _test_provider_connection_response(
    *,
    provider: str,
    payload: ModelProviderConnectionTestRequest,
    session: Session,
    settings: Settings,
) -> ModelProviderConnectionTestResponse:
    service = _get_model_provider_settings_service(session)
    models = service.test_provider_connection(
        provider=provider,
        base_url=payload.base_url,
        model=payload.model,
        api_token=payload.api_token,
        settings=settings,
    )
    return ModelProviderConnectionTestResponse(ok=True, models=models)


@router.post("/model-providers/openai/models", response_model=ModelProviderModelsResponse)
def list_openai_provider_models(
    payload: ModelProviderModelsRequest,
    principal: CurrentPrincipal = Depends(get_current_admin),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ModelProviderModelsResponse:
    del principal
    try:
        return _list_provider_models_response(
            provider=OPENAI_PROVIDER,
            payload=payload,
            session=session,
            settings=settings,
        )
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post("/model-providers/embedding/models", response_model=ModelProviderModelsResponse)
def list_embedding_provider_models(
    payload: ModelProviderModelsRequest,
    principal: CurrentPrincipal = Depends(get_current_admin),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ModelProviderModelsResponse:
    del principal
    try:
        return _list_provider_models_response(
            provider=EMBEDDING_PROVIDER,
            payload=payload,
            session=session,
            settings=settings,
        )
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post("/model-providers/openai/test", response_model=ModelProviderConnectionTestResponse)
def test_openai_provider_connection(
    payload: ModelProviderConnectionTestRequest,
    principal: CurrentPrincipal = Depends(get_current_admin),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ModelProviderConnectionTestResponse:
    del principal
    try:
        return _test_provider_connection_response(
            provider=OPENAI_PROVIDER,
            payload=payload,
            session=session,
            settings=settings,
        )
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post("/model-providers/embedding/test", response_model=ModelProviderConnectionTestResponse)
def test_embedding_provider_connection(
    payload: ModelProviderConnectionTestRequest,
    principal: CurrentPrincipal = Depends(get_current_admin),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ModelProviderConnectionTestResponse:
    del principal
    try:
        return _test_provider_connection_response(
            provider=EMBEDDING_PROVIDER,
            payload=payload,
            session=session,
            settings=settings,
        )
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
