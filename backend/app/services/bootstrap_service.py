from sqlalchemy.orm import Session

from app.core.settings import Settings
from app.models.enums import UserStatus
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.security.passwords import hash_password
from app.services.exceptions import ConflictError
from app.services.validators import normalize_optional_name, normalize_username, validate_password


class BootstrapService:
    def __init__(self, session: Session, settings: Settings, user_repository: UserRepository) -> None:
        self._session = session
        self._settings = settings
        self._users = user_repository

    def ensure_superadmin(self) -> User:
        try:
            normalized_username = normalize_username(self._settings.superadmin_username)
            validate_password(self._settings.superadmin_password)
            existing = self._users.get_by_username(self._session, normalized_username)
            if existing is None:
                user = User(
                    username=normalized_username,
                    password_hash=hash_password(self._settings.superadmin_password),
                    is_admin=True,
                    is_superadmin=True,
                    first_name=normalize_optional_name(self._settings.superadmin_first_name),
                    last_name=normalize_optional_name(self._settings.superadmin_last_name),
                    status=UserStatus.ACTIVE,
                    token_version=1,
                )
                user = self._users.create(self._session, user)
                self._session.commit()
                return user

            if not existing.is_superadmin:
                raise ConflictError(
                    "SUPERADMIN_USERNAME is already occupied by a non-superadmin user."
                )

            existing.password_hash = hash_password(self._settings.superadmin_password)
            existing.is_admin = True
            existing.is_superadmin = True
            existing.status = UserStatus.ACTIVE
            existing.deleted_at = None
            existing.deleted_by_user_id = None
            if self._settings.superadmin_first_name is not None:
                existing.first_name = normalize_optional_name(self._settings.superadmin_first_name)
            if self._settings.superadmin_last_name is not None:
                existing.last_name = normalize_optional_name(self._settings.superadmin_last_name)
            self._session.commit()
            return existing
        except Exception:
            self._session.rollback()
            raise
