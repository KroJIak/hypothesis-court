import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import UserStatus


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    is_admin: bool
    is_superadmin: bool
    first_name: str | None
    last_name: str | None
    status: UserStatus
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None


class UsersListResponse(BaseModel):
    items: list[UserResponse]
    total: int
    limit: int
    offset: int


class UserCreateRequest(BaseModel):
    username: str
    password: str
    is_admin: bool = False
    first_name: str | None = None
    last_name: str | None = None


class UserUpdateRequest(BaseModel):
    first_name: str | None = Field(default=None)
    last_name: str | None = Field(default=None)
    is_admin: bool | None = None
    status: UserStatus | None = None


class AdminPasswordResetRequest(BaseModel):
    new_password: str


class SelfProfileUpdateRequest(BaseModel):
    first_name: str | None = None
    last_name: str | None = None


class SelfPasswordChangeRequest(BaseModel):
    old_password: str
    new_password: str
    new_password_repeat: str
