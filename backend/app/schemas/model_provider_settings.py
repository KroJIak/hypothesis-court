from datetime import datetime

from pydantic import BaseModel


class ModelProviderSettingsResponse(BaseModel):
    provider: str
    provider_type: str
    base_url: str
    model: str | None
    api_token: str | None = None
    has_api_token: bool
    updated_at: datetime | None = None


class ModelProviderSettingsUpdateRequest(BaseModel):
    provider_type: str = "openai"
    base_url: str
    model: str | None = None
    api_token: str | None = None


class ModelProviderConnectionTestRequest(BaseModel):
    provider_type: str = "openai"
    base_url: str
    model: str
    api_token: str | None = None


class ModelProviderModelsRequest(BaseModel):
    provider_type: str = "openai"
    base_url: str
    api_token: str | None = None


class ModelProviderModelsResponse(BaseModel):
    models: list[str]


class ModelProviderConnectionTestResponse(BaseModel):
    ok: bool
    models: list[str]
