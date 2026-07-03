import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.settings import Settings
from app.models.audit_event import AuditEvent
from app.models.auth_refresh_session import AuthRefreshSession
from app.models.enums import AuditEventType, RefreshRevokeReason, UserStatus
from app.models.user import User
from app.repositories.audit_repository import AuditRepository
from app.repositories.auth_refresh_session_repository import AuthRefreshSessionRepository
from app.repositories.user_repository import UserRepository
from app.security.passwords import verify_password
from app.security.tokens import (
    create_access_token,
    generate_refresh_token,
    hash_refresh_token,
)
from app.services.exceptions import AuthenticationError


@dataclass(frozen=True)
class AuthResult:
    access_token: str
    refresh_token: str
    user: User


class AuthService:
    def __init__(
        self,
        session: Session,
        settings: Settings,
        user_repository: UserRepository,
        refresh_session_repository: AuthRefreshSessionRepository,
        audit_repository: AuditRepository,
    ) -> None:
        self._session = session
        self._settings = settings
        self._users = user_repository
        self._refresh_sessions = refresh_session_repository
        self._audit = audit_repository

    def login(self, *, username: str, password: str, ip_address: str | None, user_agent: str | None) -> AuthResult:
        try:
            user = self._users.get_by_username(self._session, username.strip())
            if (
                user is None
                or user.status != UserStatus.ACTIVE
                or not verify_password(password, user.password_hash)
            ):
                self._audit.create(
                    self._session,
                    AuditEvent(
                        actor_user_id=None,
                        target_user_id=user.id if user else None,
                        event_type=AuditEventType.LOGIN_FAILED,
                        payload={
                            "username": username.strip(),
                            "ip_address": ip_address,
                            "user_agent": user_agent,
                        },
                    ),
                )
                self._session.commit()
                raise AuthenticationError("Invalid username or password.")

            now = datetime.now(UTC)
            refresh_token = generate_refresh_token()
            refresh_hash = hash_refresh_token(refresh_token)
            family_id = uuid.uuid4()
            refresh_session = self._refresh_sessions.create(
                self._session,
                AuthRefreshSession(
                    user_id=user.id,
                    family_id=family_id,
                    parent_session_id=None,
                    replaced_by_session_id=None,
                    refresh_token_hash=refresh_hash,
                    issued_at=now,
                    expires_at=now + self._settings.auth_refresh_token_ttl,
                    last_used_at=now,
                    revoked_at=None,
                    revoked_reason=None,
                    ip_address=ip_address,
                    user_agent=user_agent,
                ),
            )
            self._audit.create(
                self._session,
                AuditEvent(
                    actor_user_id=user.id,
                    target_user_id=user.id,
                    event_type=AuditEventType.LOGIN_SUCCESS,
                    payload={"session_id": str(refresh_session.id)},
                ),
            )
            self._session.commit()
            return AuthResult(
                access_token=create_access_token(self._settings, user, refresh_session.id),
                refresh_token=refresh_token,
                user=user,
            )
        except AuthenticationError:
            self._session.rollback()
            raise
        except Exception:
            self._session.rollback()
            raise

    def refresh(self, *, refresh_token: str, ip_address: str | None, user_agent: str | None) -> AuthResult:
        now = datetime.now(UTC)
        refresh_hash = hash_refresh_token(refresh_token)
        try:
            current_session = self._refresh_sessions.get_by_hash_for_update(
                self._session, refresh_hash
            )
            if current_session is None:
                raise AuthenticationError("Refresh token is invalid.")

            user = self._users.get_by_id(self._session, current_session.user_id)
            if user is None or user.status != UserStatus.ACTIVE:
                raise AuthenticationError("Refresh token is invalid.")

            if current_session.replaced_by_session_id is not None:
                self._refresh_sessions.revoke_family(
                    self._session,
                    family_id=current_session.family_id,
                    revoked_at=now,
                    revoked_reason=RefreshRevokeReason.REUSE_DETECTED,
                )
                self._audit.create(
                    self._session,
                    AuditEvent(
                        actor_user_id=user.id,
                        target_user_id=user.id,
                        event_type=AuditEventType.REFRESH_REUSE_DETECTED,
                        payload={"family_id": str(current_session.family_id)},
                    ),
                )
                raise AuthenticationError("Refresh token has already been used.")

            if current_session.revoked_at is not None or current_session.expires_at <= now:
                raise AuthenticationError("Refresh token is expired or revoked.")

            next_refresh_token = generate_refresh_token()
            next_refresh_hash = hash_refresh_token(next_refresh_token)
            next_session = self._refresh_sessions.create(
                self._session,
                AuthRefreshSession(
                    user_id=user.id,
                    family_id=current_session.family_id,
                    parent_session_id=current_session.id,
                    replaced_by_session_id=None,
                    refresh_token_hash=next_refresh_hash,
                    issued_at=now,
                    expires_at=now + self._settings.auth_refresh_token_ttl,
                    last_used_at=now,
                    revoked_at=None,
                    revoked_reason=None,
                    ip_address=ip_address,
                    user_agent=user_agent,
                ),
            )
            current_session.last_used_at = now
            current_session.replaced_by_session_id = next_session.id
            current_session.revoked_at = now
            current_session.revoked_reason = RefreshRevokeReason.ROTATION_REPLACED
            self._audit.create(
                self._session,
                AuditEvent(
                    actor_user_id=user.id,
                    target_user_id=user.id,
                    event_type=AuditEventType.REFRESH_ROTATED,
                    payload={
                        "previous_session_id": str(current_session.id),
                        "new_session_id": str(next_session.id),
                    },
                ),
            )
            self._session.commit()
            return AuthResult(
                access_token=create_access_token(self._settings, user, next_session.id),
                refresh_token=next_refresh_token,
                user=user,
            )
        except AuthenticationError:
            self._session.rollback()
            raise
        except Exception:
            self._session.rollback()
            raise

    def logout(self, *, user: User, session_id: uuid.UUID) -> None:
        now = datetime.now(UTC)
        try:
            refresh_session = self._refresh_sessions.get_by_id_for_update(self._session, session_id)
            if refresh_session and refresh_session.user_id == user.id and refresh_session.revoked_at is None:
                self._refresh_sessions.revoke_session(
                    refresh_session,
                    revoked_at=now,
                    revoked_reason=RefreshRevokeReason.LOGOUT,
                )
            self._audit.create(
                self._session,
                AuditEvent(
                    actor_user_id=user.id,
                    target_user_id=user.id,
                    event_type=AuditEventType.LOGOUT,
                    payload={"session_id": str(session_id)},
                ),
            )
            self._session.commit()
        except Exception:
            self._session.rollback()
            raise

    def logout_all(self, *, user: User) -> None:
        now = datetime.now(UTC)
        try:
            self._refresh_sessions.revoke_active_for_user(
                self._session,
                user_id=user.id,
                revoked_at=now,
                revoked_reason=RefreshRevokeReason.LOGOUT_ALL,
            )
            user.token_version += 1
            self._audit.create(
                self._session,
                AuditEvent(
                    actor_user_id=user.id,
                    target_user_id=user.id,
                    event_type=AuditEventType.LOGOUT_ALL,
                    payload={},
                ),
            )
            self._session.commit()
        except Exception:
            self._session.rollback()
            raise
