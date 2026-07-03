import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

import jwt

from app.core.settings import Settings
from app.models.user import User


@dataclass(frozen=True)
class AccessTokenPayload:
    user_id: uuid.UUID
    session_id: uuid.UUID
    token_version: int
    is_admin: bool
    is_superadmin: bool


def create_access_token(settings: Settings, user: User, session_id: uuid.UUID) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user.id),
        "session_id": str(session_id),
        "token_version": user.token_version,
        "is_admin": user.is_admin,
        "is_superadmin": user.is_superadmin,
        "iat": now,
        "nbf": now,
        "exp": now + settings.auth_access_token_ttl,
    }
    return jwt.encode(payload, settings.auth_jwt_secret, algorithm="HS256")


def decode_access_token(token: str, settings: Settings) -> AccessTokenPayload:
    payload = jwt.decode(
        token,
        settings.auth_jwt_secret,
        algorithms=["HS256"],
    )
    return AccessTokenPayload(
        user_id=uuid.UUID(payload["sub"]),
        session_id=uuid.UUID(payload["session_id"]),
        token_version=int(payload["token_version"]),
        is_admin=bool(payload["is_admin"]),
        is_superadmin=bool(payload["is_superadmin"]),
    )


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(refresh_token: str) -> str:
    return hashlib.sha256(refresh_token.encode("utf-8")).hexdigest()
