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
OPENAI_PROVIDER_TYPE = "openai"
YANDEX_AI_STUDIO_PROVIDER_TYPE = "yandex_ai_studio"
OPENAI_API_TOKEN_PREFIX = "Bearer"
OPENAI_PROJECT_HEADER_NAME = "OpenAI-Project"
YANDEX_API_TOKEN_PREFIX = "Api-Key"
YANDEX_PROJECT_HEADER_NAME = "x-project"


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
            provider_type=self._get_provider_type(settings.model_provider_folder_id),
            base_url=settings.model_provider_base_url,
            project_id=settings.model_provider_folder_id,
            model=settings.model_provider_model,
            api_token=settings.model_provider_api_key,
        )

    def get_embedding_settings(self, settings: Settings) -> ModelProviderSettings | None:
        stored_settings = self._settings.get_by_provider(self._session, EMBEDDING_PROVIDER)
        if stored_settings is not None:
            return stored_settings
        return ModelProviderSettings(
            provider=EMBEDDING_PROVIDER,
            provider_type=self._get_provider_type(settings.embedding_folder_id),
            base_url=settings.embedding_base_url,
            project_id=settings.embedding_folder_id,
            model=settings.embedding_model,
            api_token=settings.embedding_api_key,
        )

    def upsert_provider_settings(
        self,
        *,
        actor: User,
        provider: str,
        provider_type: str,
        base_url: str,
        project_id: str | None,
        model: str | None,
        api_token: str | None,
    ) -> ModelProviderSettings:
        try:
            self._validate_provider(provider)
            normalized_provider_type = self._normalize_provider_type(provider_type)
            normalized_base_url = self._normalize_base_url(base_url)
            normalized_project_id = self._normalize_project_id(
                project_id,
                provider_type=normalized_provider_type,
            )
            normalized_model = self._normalize_model(model)
            normalized_api_token = self._normalize_api_token(api_token)
            settings = self._settings.get_by_provider(self._session, provider)

            if settings is None:
                settings = self._settings.create(
                    self._session,
                    ModelProviderSettings(
                        provider=provider,
                        provider_type=normalized_provider_type,
                        base_url=normalized_base_url,
                        project_id=normalized_project_id,
                        model=normalized_model,
                        api_token=normalized_api_token,
                        created_by_user_id=actor.id,
                        updated_by_user_id=actor.id,
                    ),
                )
            else:
                settings.provider_type = normalized_provider_type
                settings.base_url = normalized_base_url
                settings.project_id = normalized_project_id
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
        provider_type: str,
        base_url: str,
        project_id: str | None,
        api_token: str | None,
        settings: Settings,
    ) -> list[str]:
        self._validate_provider(provider)
        normalized_provider_type = self._normalize_provider_type(provider_type)
        normalized_base_url = self._normalize_base_url(base_url)
        normalized_project_id = self._normalize_project_id(
            project_id,
            provider_type=normalized_provider_type,
        )
        resolved_api_token = self._resolve_api_token(provider=provider, api_token=api_token, settings=settings)
        return self._create_provider_client(
            provider_type=normalized_provider_type,
            base_url=normalized_base_url,
            api_token=resolved_api_token,
            project_id=normalized_project_id,
        ).list_models()

    def test_provider_connection(
        self,
        *,
        provider: str,
        provider_type: str,
        base_url: str,
        project_id: str | None,
        model: str,
        api_token: str | None,
        settings: Settings,
    ) -> list[str]:
        self._validate_provider(provider)
        normalized_provider_type = self._normalize_provider_type(provider_type)
        normalized_base_url = self._normalize_base_url(base_url)
        normalized_project_id = self._normalize_project_id(
            project_id,
            provider_type=normalized_provider_type,
        )
        normalized_model = self._normalize_model(model)
        resolved_api_token = self._resolve_api_token(provider=provider, api_token=api_token, settings=settings)
        return self._create_provider_client(
            provider_type=normalized_provider_type,
            base_url=normalized_base_url,
            api_token=resolved_api_token,
            project_id=normalized_project_id,
        ).assert_model_available(normalized_model)

    def get_default_settings(self, provider: str, settings: Settings) -> ModelProviderSettings:
        self._validate_provider(provider)
        if provider == EMBEDDING_PROVIDER:
            return ModelProviderSettings(
                provider=EMBEDDING_PROVIDER,
                provider_type=self._get_provider_type(settings.embedding_folder_id),
                base_url=settings.embedding_base_url,
                project_id=settings.embedding_folder_id,
                model=settings.embedding_model,
                api_token=settings.embedding_api_key,
            )
        return ModelProviderSettings(
            provider=OPENAI_PROVIDER,
            provider_type=self._get_provider_type(settings.model_provider_folder_id),
            base_url=settings.model_provider_base_url,
            project_id=settings.model_provider_folder_id,
            model=settings.model_provider_model,
            api_token=settings.model_provider_api_key,
        )

    def get_model_client(self, settings: Settings) -> tuple[OpenAICompatibleClient, str]:
        provider_settings = self.get_model_settings(settings)
        if provider_settings is None:
            raise ValidationError("LLM-провайдер не настроен")
        api_token = provider_settings.api_token or settings.model_provider_api_key
        model = self._normalize_model(provider_settings.model)
        if not provider_settings.base_url or api_token is None or model is None:
            raise ValidationError("LLM-провайдер не настроен")
        return (
            self._create_provider_client(
                provider_type=provider_settings.provider_type,
                base_url=provider_settings.base_url,
                api_token=api_token,
                project_id=provider_settings.project_id,
            ),
            model,
        )

    def get_embedding_client(self, settings: Settings) -> tuple[OpenAICompatibleClient, str]:
        provider_settings = self.get_embedding_settings(settings)
        if provider_settings is None:
            raise ValidationError("Embedding-провайдер не настроен")
        api_token = provider_settings.api_token or settings.embedding_api_key
        model = self._normalize_model(provider_settings.model)
        if not provider_settings.base_url or api_token is None or model is None:
            raise ValidationError("Embedding-провайдер не настроен")
        return (
            self._create_provider_client(
                provider_type=provider_settings.provider_type,
                base_url=provider_settings.base_url,
                api_token=api_token,
                project_id=provider_settings.project_id,
            ),
            model,
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
            raise ValidationError("Неизвестный провайдер модели")

    @staticmethod
    def _normalize_provider_type(provider_type: str) -> str:
        normalized = provider_type.strip()
        if normalized not in {OPENAI_PROVIDER_TYPE, YANDEX_AI_STUDIO_PROVIDER_TYPE}:
            raise ValidationError("Неизвестный тип провайдера")
        return normalized

    @staticmethod
    def _get_provider_type(folder_id: str | None) -> str:
        return YANDEX_AI_STUDIO_PROVIDER_TYPE if folder_id else OPENAI_PROVIDER_TYPE

    @staticmethod
    def _normalize_base_url(base_url: str) -> str:
        normalized = base_url.strip().rstrip("/")
        parsed = urlparse(normalized)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValidationError("Base URL должен быть корректным http или https адресом")
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
    def _normalize_project_id(project_id: str | None, *, provider_type: str) -> str | None:
        if provider_type != YANDEX_AI_STUDIO_PROVIDER_TYPE:
            return None
        if project_id is None:
            raise ValidationError("Folder ID обязателен для Yandex AI Studio")
        normalized = project_id.strip()
        if not normalized:
            raise ValidationError("Folder ID обязателен для Yandex AI Studio")
        if len(normalized) > 255:
            raise ValidationError("Folder ID должен быть не длиннее 255 символов")
        return normalized

    @staticmethod
    def _create_provider_client(
        *,
        provider_type: str,
        base_url: str,
        api_token: str | None,
        project_id: str | None,
    ) -> OpenAICompatibleClient:
        if provider_type == YANDEX_AI_STUDIO_PROVIDER_TYPE:
            return OpenAICompatibleClient(
                base_url=base_url,
                api_token=api_token,
                project_id=project_id,
                api_token_prefix=YANDEX_API_TOKEN_PREFIX,
                project_header_name=YANDEX_PROJECT_HEADER_NAME,
            )
        return OpenAICompatibleClient(
            base_url=base_url,
            api_token=api_token,
            project_id=project_id,
            api_token_prefix=OPENAI_API_TOKEN_PREFIX,
            project_header_name=OPENAI_PROJECT_HEADER_NAME,
        )

    @staticmethod
    def _normalize_api_token(api_token: str | None) -> str | None:
        if api_token is None:
            return None
        normalized = api_token.strip()
        if not normalized:
            return None
        return normalized
