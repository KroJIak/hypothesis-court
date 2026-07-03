import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session
from fastapi import UploadFile

from app.models.audit_event import AuditEvent
from app.models.enums import AuditEventType, RefreshRevokeReason, UserStatus
from app.models.user import User
from app.repositories.audit_repository import AuditRepository
from app.repositories.auth_refresh_session_repository import AuthRefreshSessionRepository
from app.repositories.user_repository import UserRepository
from app.security.passwords import hash_password, verify_password
from app.services.avatar_storage import AvatarStorage
from app.services.exceptions import AuthorizationError, ConflictError, NotFoundError, ValidationError
from app.services.validators import normalize_optional_name, normalize_username, validate_password


class UserService:
    def __init__(
        self,
        session: Session,
        user_repository: UserRepository,
        refresh_session_repository: AuthRefreshSessionRepository,
        audit_repository: AuditRepository,
    ) -> None:
        self._session = session
        self._users = user_repository
        self._refresh_sessions = refresh_session_repository
        self._audit = audit_repository

    async def update_avatar(self, *, user: User, file: UploadFile, avatar_storage: AvatarStorage) -> User:
        previous_object_key = user.avatar_object_key
        next_object_key = await avatar_storage.save(file)
        try:
            user.avatar_object_key = next_object_key
            self._audit.create(
                self._session,
                AuditEvent(
                    actor_user_id=user.id,
                    target_user_id=user.id,
                    event_type=AuditEventType.USER_UPDATED,
                    payload={"avatar_updated": True},
                ),
            )
            self._session.commit()
            avatar_storage.delete(previous_object_key)
            return user
        except Exception:
            self._session.rollback()
            avatar_storage.delete(next_object_key)
            raise

    def list_users(
        self,
        *,
        search: str | None,
        is_admin: bool | None,
        status: UserStatus | None,
        limit: int,
        offset: int,
    ) -> tuple[list[User], int]:
        return self._users.list_users(
            self._session,
            search=search,
            is_admin=is_admin,
            status=status,
            limit=limit,
            offset=offset,
        )

    def get_user(self, user_id: uuid.UUID) -> User:
        user = self._users.get_by_id(self._session, user_id)
        if user is None:
            raise NotFoundError("User not found.")
        return user

    def create_user(
        self,
        *,
        actor: User,
        username: str,
        password: str,
        is_admin: bool,
        first_name: str | None,
        last_name: str | None,
    ) -> User:
        try:
            if is_admin and not actor.is_superadmin:
                raise AuthorizationError("Only superadmin can create admins.")

            normalized_username = normalize_username(username)
            validate_password(password)
            if self._users.get_by_username(self._session, normalized_username) is not None:
                raise ConflictError("Username is already taken.")

            user = self._users.create(
                self._session,
                User(
                    username=normalized_username,
                    password_hash=hash_password(password),
                    is_admin=is_admin,
                    is_superadmin=False,
                    first_name=normalize_optional_name(first_name),
                    last_name=normalize_optional_name(last_name),
                    status=UserStatus.ACTIVE,
                    token_version=1,
                    created_by_user_id=actor.id,
                ),
            )
            self._audit.create(
                self._session,
                AuditEvent(
                    actor_user_id=actor.id,
                    target_user_id=user.id,
                    event_type=AuditEventType.USER_CREATED,
                    payload={"username": user.username, "is_admin": user.is_admin},
                ),
            )
            self._session.commit()
            return user
        except Exception:
            self._session.rollback()
            raise

    def update_user(
        self,
        *,
        actor: User,
        user_id: uuid.UUID,
        first_name: str | None,
        last_name: str | None,
        is_admin: bool | None,
        status: UserStatus | None,
    ) -> User:
        try:
            user = self.get_user(user_id)
            self._ensure_actor_can_manage_user(actor=actor, user=user)
            if is_admin and not actor.is_superadmin:
                raise AuthorizationError("Only superadmin can grant admin access.")
            if user.is_superadmin:
                if is_admin is False:
                    raise AuthorizationError("Superadmin cannot lose admin access.")
                if status is not None and status != UserStatus.ACTIVE:
                    raise AuthorizationError("Superadmin must remain active.")
            if status == UserStatus.DELETED:
                raise ValidationError("Use delete endpoint for logical deletion.")

            if first_name is not None:
                user.first_name = normalize_optional_name(first_name)
            if last_name is not None:
                user.last_name = normalize_optional_name(last_name)
            if is_admin is not None:
                user.is_admin = is_admin or user.is_superadmin
            if status is not None:
                user.status = status
            self._audit.create(
                self._session,
                AuditEvent(
                    actor_user_id=actor.id,
                    target_user_id=user.id,
                    event_type=AuditEventType.USER_UPDATED,
                    payload={"is_admin": user.is_admin, "status": user.status.value},
                ),
            )
            self._session.commit()
            return user
        except Exception:
            self._session.rollback()
            raise

    def reset_password(self, *, actor: User, user_id: uuid.UUID, new_password: str) -> None:
        try:
            user = self.get_user(user_id)
            self._ensure_actor_can_manage_user(actor=actor, user=user)
            validate_password(new_password)
            now = datetime.now(UTC)
            user.password_hash = hash_password(new_password)
            user.token_version += 1
            self._refresh_sessions.revoke_active_for_user(
                self._session,
                user_id=user.id,
                revoked_at=now,
                revoked_reason=RefreshRevokeReason.ADMIN_RESET,
            )
            self._audit.create(
                self._session,
                AuditEvent(
                    actor_user_id=actor.id,
                    target_user_id=user.id,
                    event_type=AuditEventType.PASSWORD_RESET,
                    payload={},
                ),
            )
            self._session.commit()
        except Exception:
            self._session.rollback()
            raise

    def delete_user(self, *, actor: User, user_id: uuid.UUID) -> None:
        try:
            user = self.get_user(user_id)
            self._ensure_actor_can_manage_user(actor=actor, user=user)
            if user.is_superadmin:
                raise AuthorizationError("Superadmin cannot be deleted.")

            now = datetime.now(UTC)
            user.status = UserStatus.DELETED
            user.deleted_at = now
            user.deleted_by_user_id = actor.id
            user.token_version += 1
            self._refresh_sessions.revoke_active_for_user(
                self._session,
                user_id=user.id,
                revoked_at=now,
                revoked_reason=RefreshRevokeReason.ADMIN_DELETE,
            )
            self._audit.create(
                self._session,
                AuditEvent(
                    actor_user_id=actor.id,
                    target_user_id=user.id,
                    event_type=AuditEventType.USER_DELETED,
                    payload={},
                ),
            )
            self._session.commit()
        except Exception:
            self._session.rollback()
            raise

    @staticmethod
    def _ensure_actor_can_manage_user(*, actor: User, user: User) -> None:
        if user.is_admin and not actor.is_superadmin:
            raise AuthorizationError("Admins can manage regular users only.")

    def update_profile(self, *, user: User, first_name: str | None, last_name: str | None) -> User:
        try:
            user.first_name = normalize_optional_name(first_name)
            user.last_name = normalize_optional_name(last_name)
            self._audit.create(
                self._session,
                AuditEvent(
                    actor_user_id=user.id,
                    target_user_id=user.id,
                    event_type=AuditEventType.USER_UPDATED,
                    payload={"self_service": True},
                ),
            )
            self._session.commit()
            return user
        except Exception:
            self._session.rollback()
            raise

    def change_password(
        self,
        *,
        user: User,
        old_password: str,
        new_password: str,
        new_password_repeat: str,
    ) -> None:
        try:
            if new_password != new_password_repeat:
                raise ValidationError("New password confirmation does not match.")
            if not verify_password(old_password, user.password_hash):
                raise ValidationError("Old password is incorrect.")

            validate_password(new_password)
            now = datetime.now(UTC)
            user.password_hash = hash_password(new_password)
            user.token_version += 1
            self._refresh_sessions.revoke_active_for_user(
                self._session,
                user_id=user.id,
                revoked_at=now,
                revoked_reason=RefreshRevokeReason.PASSWORD_CHANGED,
            )
            self._audit.create(
                self._session,
                AuditEvent(
                    actor_user_id=user.id,
                    target_user_id=user.id,
                    event_type=AuditEventType.PASSWORD_CHANGED,
                    payload={},
                ),
            )
            self._session.commit()
        except Exception:
            self._session.rollback()
            raise
