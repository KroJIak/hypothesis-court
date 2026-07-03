from urllib.parse import urlparse

from sqlalchemy.orm import Session

from app.models.model_provider_settings import ModelProviderSettings
from app.models.user import User
from app.repositories.model_provider_settings_repository import ModelProviderSettingsRepository
from app.services.exceptions import ValidationError

OPENAI_PROVIDER = "openai"


class ModelProviderSettingsService:
    def __init__(
        self,
        session: Session,
        settings_repository: ModelProviderSettingsRepository,
    ) -> None:
        self._session = session
        self._settings = settings_repository

    def get_openai_settings(self) -> ModelProviderSettings | None:
        return self._settings.get_by_provider(self._session, OPENAI_PROVIDER)

    def upsert_openai_settings(
        self,
        *,
        actor: User,
        base_url: str,
        api_token: str | None,
    ) -> ModelProviderSettings:
        try:
            normalized_base_url = self._normalize_base_url(base_url)
            normalized_api_token = self._normalize_api_token(api_token)
            settings = self.get_openai_settings()

            if settings is None:
                settings = self._settings.create(
                    self._session,
                    ModelProviderSettings(
                        provider=OPENAI_PROVIDER,
                        base_url=normalized_base_url,
                        api_token=normalized_api_token,
                        created_by_user_id=actor.id,
                        updated_by_user_id=actor.id,
                    ),
                )
            else:
                settings.base_url = normalized_base_url
                settings.updated_by_user_id = actor.id
                if normalized_api_token is not None:
                    settings.api_token = normalized_api_token

            self._session.commit()
            return settings
        except Exception:
            self._session.rollback()
            raise

    @staticmethod
    def _normalize_base_url(base_url: str) -> str:
        normalized = base_url.strip().rstrip("/")
        parsed = urlparse(normalized)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValidationError("Base URL must be a valid http or https URL.")
        return normalized

    @staticmethod
    def _normalize_api_token(api_token: str | None) -> str | None:
        if api_token is None:
            return None
        normalized = api_token.strip()
        if not normalized:
            return None
        return normalized
