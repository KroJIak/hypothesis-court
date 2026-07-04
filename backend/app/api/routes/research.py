import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps.auth import get_current_user
from app.core.settings import Settings, get_settings
from app.db.session import get_db_session
from app.models.user import User
from app.repositories.research_repository import ResearchRepository
from app.repositories.model_provider_settings_repository import ModelProviderSettingsRepository
from app.schemas.research import (
    PipelineSettingsResponse,
    ResearchExportResponse,
    ResearchFeedbackCreateRequest,
    ResearchFeedbackListResponse,
    ResearchFeedbackResponse,
    ResearchGraphResponse,
    ResearchRunCreateRequest,
    ResearchRunDetailResponse,
    ResearchRunEditRequest,
    ResearchRunProgressResponse,
    ResearchRunListResponse,
    ResearchRunRegenerateRequest,
    ResearchRunSummaryResponse,
)
from app.services.exceptions import ServiceError
from app.services.model_provider_settings_service import ModelProviderSettingsService
from app.services.research_llm_orchestrator import ResearchLlmOrchestrator
from app.services.research_retrieval_service import ResearchRetrievalService
from app.services.research_service import ResearchService

router = APIRouter(prefix="/chat-sessions/{chat_session_id}/research-runs", tags=["research-runs"])


def _get_research_service(session: Session, settings: Settings) -> ResearchService:
    provider_settings_service = ModelProviderSettingsService(
        session=session,
        settings_repository=ModelProviderSettingsRepository(),
    )
    return ResearchService(
        session=session,
        repository=ResearchRepository(),
        settings=settings,
        retrieval_service=ResearchRetrievalService(
            provider_settings_service=provider_settings_service,
            settings=settings,
        ),
        llm_orchestrator=ResearchLlmOrchestrator(
            provider_settings_service=provider_settings_service,
            settings=settings,
        ),
    )


@router.get("", response_model=ResearchRunListResponse)
def list_research_runs(
    chat_session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ResearchRunListResponse:
    service = _get_research_service(session, settings)
    try:
        return service.list_runs(user=current_user, chat_session_id=chat_session_id)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.get("/settings", response_model=PipelineSettingsResponse)
def get_research_pipeline_settings(
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_user),
) -> PipelineSettingsResponse:
    del current_user
    service = _get_research_service(session, settings)
    return service.get_pipeline_settings()


@router.post("", response_model=ResearchRunDetailResponse, status_code=status.HTTP_201_CREATED)
def create_research_run(
    chat_session_id: uuid.UUID,
    payload: ResearchRunCreateRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ResearchRunDetailResponse:
    service = _get_research_service(session, settings)
    try:
        return service.create_run(
            user=current_user,
            chat_session_id=chat_session_id,
            input_requests=payload.inputs,
            hypothesis_count=payload.hypothesis_count,
        )
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.get("/active", response_model=ResearchRunDetailResponse)
def get_active_research_run(
    chat_session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ResearchRunDetailResponse:
    service = _get_research_service(session, settings)
    try:
        return service.get_active_run(user=current_user, chat_session_id=chat_session_id)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.get("/{run_id}/progress", response_model=ResearchRunProgressResponse)
def get_research_run_progress(
    chat_session_id: uuid.UUID,
    run_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ResearchRunProgressResponse:
    service = _get_research_service(session, settings)
    try:
        return service.get_progress(user=current_user, chat_session_id=chat_session_id, run_id=run_id)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.get("/{run_id}/export", response_model=ResearchExportResponse)
def export_research_run(
    chat_session_id: uuid.UUID,
    run_id: uuid.UUID,
    export_format: str = Query(default="json", alias="format", pattern="^(json|md|markdown)$"),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ResearchExportResponse:
    service = _get_research_service(session, settings)
    try:
        return service.export_run(
            user=current_user,
            chat_session_id=chat_session_id,
            run_id=run_id,
            export_format=export_format,
        )
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.get("/{run_id}/feedback", response_model=ResearchFeedbackListResponse)
def list_research_feedback(
    chat_session_id: uuid.UUID,
    run_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ResearchFeedbackListResponse:
    service = _get_research_service(session, settings)
    try:
        return service.list_feedback(user=current_user, chat_session_id=chat_session_id, run_id=run_id)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post("/{run_id}/feedback", response_model=ResearchFeedbackResponse, status_code=status.HTTP_201_CREATED)
def create_research_feedback(
    chat_session_id: uuid.UUID,
    run_id: uuid.UUID,
    payload: ResearchFeedbackCreateRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ResearchFeedbackResponse:
    service = _get_research_service(session, settings)
    try:
        return service.create_feedback(
            user=current_user,
            chat_session_id=chat_session_id,
            run_id=run_id,
            payload=payload,
        )
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post("/{run_id}/activate", response_model=ResearchRunSummaryResponse)
def activate_research_run(
    chat_session_id: uuid.UUID,
    run_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ResearchRunSummaryResponse:
    service = _get_research_service(session, settings)
    try:
        return service.activate_run(user=current_user, chat_session_id=chat_session_id, run_id=run_id)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post("/{run_id}/regenerate", response_model=ResearchRunDetailResponse, status_code=status.HTTP_201_CREATED)
def regenerate_research_run(
    chat_session_id: uuid.UUID,
    run_id: uuid.UUID,
    payload: ResearchRunRegenerateRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ResearchRunDetailResponse:
    service = _get_research_service(session, settings)
    try:
        return service.regenerate_run(
            user=current_user,
            chat_session_id=chat_session_id,
            run_id=run_id,
            hypothesis_count=payload.hypothesis_count,
        )
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post("/{run_id}/edit", response_model=ResearchRunDetailResponse, status_code=status.HTTP_201_CREATED)
def edit_research_run(
    chat_session_id: uuid.UUID,
    run_id: uuid.UUID,
    payload: ResearchRunEditRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ResearchRunDetailResponse:
    service = _get_research_service(session, settings)
    try:
        return service.edit_run(
            user=current_user,
            chat_session_id=chat_session_id,
            run_id=run_id,
            input_requests=payload.inputs,
            hypothesis_count=payload.hypothesis_count,
        )
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post("/{run_id}/cancel", response_model=ResearchRunSummaryResponse)
def cancel_research_run(
    chat_session_id: uuid.UUID,
    run_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ResearchRunSummaryResponse:
    service = _get_research_service(session, settings)
    try:
        return service.cancel_run(user=current_user, chat_session_id=chat_session_id, run_id=run_id)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.get("/{run_id}/graph", response_model=ResearchGraphResponse)
def get_research_graph(
    chat_session_id: uuid.UUID,
    run_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ResearchGraphResponse:
    service = _get_research_service(session, settings)
    try:
        return service.get_graph(user=current_user, chat_session_id=chat_session_id, run_id=run_id)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.get("/{run_id}", response_model=ResearchRunDetailResponse)
def get_research_run(
    chat_session_id: uuid.UUID,
    run_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ResearchRunDetailResponse:
    service = _get_research_service(session, settings)
    try:
        return service.get_run(user=current_user, chat_session_id=chat_session_id, run_id=run_id)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
