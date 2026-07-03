from datetime import datetime

from pydantic import BaseModel


class ModelProviderSettingsResponse(BaseModel):
    provider: str
    base_url: str
    has_api_token: bool
    updated_at: datetime | None = None


class ModelProviderSettingsUpdateRequest(BaseModel):
    base_url: str
    api_token: str | None = None
