from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps.auth import get_current_user
from app.core.settings import Settings, get_settings
from app.db.session import get_db_session
from app.models.user import User
from app.repositories.chat_session_repository import ChatSessionRepository
from app.repositories.session_file_repository import SessionFileRepository
from app.services.exceptions import ServiceError
from app.services.session_file_service import SessionFileService

router = APIRouter(prefix="/uploads", tags=["uploads"])


def _safe_upload_path(settings: Settings, object_key: str) -> Path:
    path = settings.uploads_dir / object_key
    try:
        path.resolve().relative_to(settings.uploads_dir.resolve())
    except ValueError:
        raise HTTPException(status_code=404, detail="Upload not found.") from None
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Upload not found.")
    return Path(path)


@router.get("/avatars/{filename}", response_class=FileResponse)
def download_avatar(
    filename: str,
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> FileResponse:
    object_key = f"avatars/{filename}"
    if current_user.avatar_object_key != object_key:
        raise HTTPException(status_code=404, detail="Avatar not found.")

    return FileResponse(
        path=_safe_upload_path(settings, object_key),
        media_type="image/*",
    )


@router.get("/{object_key:path}", response_class=FileResponse)
def download_upload(
    object_key: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> FileResponse:
    service = SessionFileService(
        session=session,
        chat_session_repository=ChatSessionRepository(),
        session_file_repository=SessionFileRepository(),
    )
    try:
        session_file = service.get_downloadable_file(user=current_user, object_key=object_key)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    return FileResponse(
        path=_safe_upload_path(settings, session_file.object_key),
        media_type=session_file.content_type or "application/octet-stream",
        filename=session_file.original_filename,
    )
