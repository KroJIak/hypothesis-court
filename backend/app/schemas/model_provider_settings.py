from datetime import datetime

from pydantic import BaseModel


class ModelProviderSettingsResponse(BaseModel):
    provider: str
    base_url: str
    model: str | None
    has_api_token: bool
    updated_at: datetime | None = None


class ModelProviderSettingsUpdateRequest(BaseModel):
    base_url: str
    model: str | None = None
    api_token: str | None = None


class ModelProviderConnectionTestRequest(BaseModel):
    base_url: str
    model: str
    api_token: str | None = None


class ModelProviderModelsRequest(BaseModel):
    base_url: str
    api_token: str | None = None


class ModelProviderModelsResponse(BaseModel):
    models: list[str]


class ModelProviderConnectionTestResponse(BaseModel):
    ok: bool
    models: list[str]
