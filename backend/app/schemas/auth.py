from pydantic import BaseModel, ConfigDict

from app.schemas.user import UserResponse


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class AuthTokensResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    access_token_expires_in: int
    refresh_token_expires_in: int
    user: UserResponse


class MessageResponse(BaseModel):
    message: str
