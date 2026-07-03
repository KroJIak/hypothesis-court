from sqlalchemy.orm import Session

from app.models.model_provider_settings import ModelProviderSettings


class ModelProviderSettingsRepository:
    def get_by_provider(
        self,
        session: Session,
        provider: str,
    ) -> ModelProviderSettings | None:
        return session.get(ModelProviderSettings, provider)

    def create(
        self,
        session: Session,
        settings: ModelProviderSettings,
    ) -> ModelProviderSettings:
        session.add(settings)
        session.flush()
        return settings
