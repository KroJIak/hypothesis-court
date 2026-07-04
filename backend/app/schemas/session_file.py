import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import DocumentProcessingStatus


class SessionFileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    chat_session_id: uuid.UUID
    original_filename: str
    content_type: str | None
    kind: str | None
    size_bytes: int
    processing_status: DocumentProcessingStatus
    processing_error: str | None
    text_extracted_at: datetime | None
    download_url: str
    created_at: datetime


class SessionFilesListResponse(BaseModel):
    items: list[SessionFileResponse]
    total: int
    max_files: int
