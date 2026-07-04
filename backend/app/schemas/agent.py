import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AgentIconResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    icon_key: str
    label: str
    sort_order: int


class UserAgentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    variant: str
    system_prompt: str
    is_custom: bool = True
    is_empty: bool = False
    created_at: datetime
    updated_at: datetime


class UserAgentsListResponse(BaseModel):
    items: list[UserAgentResponse]


class AgentGenerationStatusResponse(BaseModel):
    available: bool


class UserAgentCreateRequest(BaseModel):
    name: str | None = None
    variant: str | None = None
    system_prompt: str | None = None


class UserAgentUpdateRequest(BaseModel):
    name: str
    variant: str | None = None
    system_prompt: str


class UserAgentGenerateRequest(BaseModel):
    name: str
    system_prompt: str | None = None


class ChatSessionAgentAttachRequest(BaseModel):
    agent_id: uuid.UUID
    placement: str = "right"
    position: int | None = None


class ChatSessionAgentResponse(UserAgentResponse):
    placement: str = "right"
    position: int = 0


class ChatSessionAgentsListResponse(BaseModel):
    items: list[ChatSessionAgentResponse]
