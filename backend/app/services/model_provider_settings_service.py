from urllib.parse import urlparse

from sqlalchemy.orm import Session

from app.core.settings import Settings
from app.models.model_provider_settings import ModelProviderSettings
from app.models.user import User
from app.repositories.model_provider_settings_repository import ModelProviderSettingsRepository
from app.services.exceptions import ValidationError
from app.services.openai_compatible_client import OpenAICompatibleClient

OPENAI_PROVIDER = "openai"
EMBEDDING_PROVIDER = "embedding"


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

    def get_model_settings(self, settings: Settings) -> ModelProviderSettings | None:
        stored_settings = self._settings.get_by_provider(self._session, OPENAI_PROVIDER)
        if stored_settings is not None:
            return stored_settings
        return ModelProviderSettings(
            provider=OPENAI_PROVIDER,
            base_url=settings.model_provider_base_url,
            model=settings.model_provider_model,
            api_token=settings.model_provider_api_key,
        )

    def get_embedding_settings(self, settings: Settings) -> ModelProviderSettings | None:
        stored_settings = self._settings.get_by_provider(self._session, EMBEDDING_PROVIDER)
        if stored_settings is not None:
            return stored_settings
        return ModelProviderSettings(
            provider=EMBEDDING_PROVIDER,
            base_url=settings.embedding_base_url,
            model=settings.embedding_model,
            api_token=settings.embedding_api_key,
        )

    def upsert_provider_settings(
        self,
        *,
        actor: User,
        provider: str,
        base_url: str,
        model: str | None,
        api_token: str | None,
    ) -> ModelProviderSettings:
        try:
            self._validate_provider(provider)
            normalized_base_url = self._normalize_base_url(base_url)
            normalized_model = self._normalize_model(model)
            normalized_api_token = self._normalize_api_token(api_token)
            settings = self._settings.get_by_provider(self._session, provider)

            if settings is None:
                settings = self._settings.create(
                    self._session,
                    ModelProviderSettings(
                        provider=provider,
                        base_url=normalized_base_url,
                        model=normalized_model,
                        api_token=normalized_api_token,
                        created_by_user_id=actor.id,
                        updated_by_user_id=actor.id,
                    ),
                )
            else:
                settings.base_url = normalized_base_url
                settings.model = normalized_model
                settings.updated_by_user_id = actor.id
                if normalized_api_token is not None:
                    settings.api_token = normalized_api_token

            self._session.commit()
            return settings
        except Exception:
            self._session.rollback()
            raise

    def list_provider_models(
        self,
        *,
        provider: str,
        base_url: str,
        api_token: str | None,
        settings: Settings,
    ) -> list[str]:
        self._validate_provider(provider)
        normalized_base_url = self._normalize_base_url(base_url)
        resolved_api_token = self._resolve_api_token(provider=provider, api_token=api_token, settings=settings)
        return OpenAICompatibleClient(
            base_url=normalized_base_url,
            api_token=resolved_api_token,
        ).list_models()

    def test_provider_connection(
        self,
        *,
        provider: str,
        base_url: str,
        model: str,
        api_token: str | None,
        settings: Settings,
    ) -> list[str]:
        self._validate_provider(provider)
        normalized_base_url = self._normalize_base_url(base_url)
        normalized_model = self._normalize_model(model)
        resolved_api_token = self._resolve_api_token(provider=provider, api_token=api_token, settings=settings)
        return OpenAICompatibleClient(
            base_url=normalized_base_url,
            api_token=resolved_api_token,
        ).assert_model_available(normalized_model)

    def get_default_settings(self, provider: str, settings: Settings) -> ModelProviderSettings:
        self._validate_provider(provider)
        if provider == EMBEDDING_PROVIDER:
            return ModelProviderSettings(
                provider=EMBEDDING_PROVIDER,
                base_url=settings.embedding_base_url,
                model=settings.embedding_model,
                api_token=settings.embedding_api_key,
            )
        return ModelProviderSettings(
            provider=OPENAI_PROVIDER,
            base_url=settings.model_provider_base_url,
            model=settings.model_provider_model,
            api_token=settings.model_provider_api_key,
        )

    def _resolve_api_token(self, *, provider: str, api_token: str | None, settings: Settings) -> str | None:
        normalized_api_token = self._normalize_api_token(api_token)
        if normalized_api_token is not None:
            return normalized_api_token

        stored_settings = self._settings.get_by_provider(self._session, provider)
        if stored_settings is not None and stored_settings.api_token:
            return stored_settings.api_token

        if provider == EMBEDDING_PROVIDER:
            return settings.embedding_api_key
        if provider == OPENAI_PROVIDER:
            return settings.model_provider_api_key
        return None

    @staticmethod
    def _validate_provider(provider: str) -> None:
        if provider not in {OPENAI_PROVIDER, EMBEDDING_PROVIDER}:
            raise ValidationError("Unknown model provider.")

    @staticmethod
    def _normalize_base_url(base_url: str) -> str:
        normalized = base_url.strip().rstrip("/")
        parsed = urlparse(normalized)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValidationError("Base URL must be a valid http or https URL.")
        return normalized

    @staticmethod
    def _normalize_model(model: str | None) -> str | None:
        if model is None:
            return None
        normalized = model.strip()
        if not normalized:
            return None
        if len(normalized) > 255:
            raise ValidationError("Model must contain at most 255 characters.")
        return normalized

    @staticmethod
    def _normalize_api_token(api_token: str | None) -> str | None:
        if api_token is None:
            return None
        normalized = api_token.strip()
        if not normalized:
            return None
        return normalized
