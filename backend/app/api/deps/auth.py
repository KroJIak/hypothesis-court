from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.settings import Settings, get_settings
from app.db.session import get_db_session
from app.models.enums import UserStatus
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.security.tokens import AccessTokenPayload, decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentPrincipal:
    user: User
    token: AccessTokenPayload


def get_current_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> CurrentPrincipal:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing access token.")

    try:
        payload = decode_access_token(credentials.credentials, settings)
    except (jwt.InvalidTokenError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token.") from None

    user = UserRepository().get_by_id(session, payload.user_id)
    if user is None or user.status != UserStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User session is not active.")
    if user.token_version != payload.token_version:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session is no longer valid.")

    return CurrentPrincipal(user=user, token=payload)


def get_current_user(principal: CurrentPrincipal = Depends(get_current_principal)) -> User:
    return principal.user


def get_current_admin(principal: CurrentPrincipal = Depends(get_current_principal)) -> CurrentPrincipal:
    if not principal.user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required.")
    return principal
