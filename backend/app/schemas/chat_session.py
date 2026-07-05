import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import ResearchInputKind


class ChatSessionDraftInput(BaseModel):
    kind: ResearchInputKind
    label: str
    text: str


class ChatSessionDraftInputsUpdateRequest(BaseModel):
    inputs: list[ChatSessionDraftInput]


class ChatSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    active_research_run_id: uuid.UUID | None
    title: str
    draft_inputs: list[ChatSessionDraftInput]
    is_started: bool
    is_pinned: bool
    pinned_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ChatSessionsListResponse(BaseModel):
    items: list[ChatSessionResponse]
    total: int
    limit: int
    offset: int
    max_pinned: int


class ChatSessionCreateRequest(BaseModel):
    title: str


class ChatSessionRenameRequest(BaseModel):
    title: str
