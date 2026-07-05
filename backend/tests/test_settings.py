from datetime import timedelta

import pytest

from app.core import settings as settings_module


ENV_NAMES = (
    "BACKEND_CORS_ALLOW_ORIGINS",
    "POSTGRES_DB",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "AUTH_JWT_SECRET",
    "AUTH_ACCESS_TOKEN_TTL",
    "AUTH_REFRESH_TOKEN_TTL",
    "SUPERADMIN_USERNAME",
    "SUPERADMIN_PASSWORD",
    "SUPERADMIN_FIRST_NAME",
    "SUPERADMIN_LAST_NAME",
    "CHAT_MAX_PINNED_SESSIONS",
    "SESSION_MAX_FILES",
    "SESSION_FILE_UPLOAD_MAX_BYTES",
    "USER_MAX_AGENTS",
    "MODEL_PROVIDER_BASE_URL",
    "MODEL_PROVIDER_API_KEY",
    "MODEL_PROVIDER_MODEL",
    "MODEL_PROVIDER_FOLDER_ID",
    "MODEL_PROVIDER_API_MODE",
    "EMBEDDING_BASE_URL",
    "EMBEDDING_API_KEY",
    "EMBEDDING_MODEL",
    "EMBEDDING_FOLDER_ID",
)


@pytest.fixture(autouse=True)
def clear_settings_cache():
    settings_module.get_settings.cache_clear()
    yield
    settings_module.get_settings.cache_clear()


def test_settings_use_defaults_when_env_is_missing(monkeypatch):
    monkeypatch.setattr(settings_module, "_load_env", lambda: None)
    for name in ENV_NAMES:
        monkeypatch.delenv(name, raising=False)
    settings_module.get_settings.cache_clear()

    settings = settings_module.get_settings()

    assert settings.postgres_db == "hypothesis_court"
    assert settings.postgres_user == "hypothesis_court"
    assert settings.postgres_password == "hypothesis_court"
    assert settings.auth_access_token_ttl == timedelta(days=1)
    assert settings.auth_refresh_token_ttl == timedelta(weeks=1)
    assert settings.superadmin_username == "superadmin"
    assert settings.superadmin_password == "change-me"
    assert settings.model_provider_base_url == "https://api.openai.com/v1"
    assert settings.model_provider_model == "gpt-4o-mini"
    assert settings.model_provider_api_key is None
    assert settings.embedding_base_url == "https://api.openai.com/v1"
    assert settings.embedding_model == "text-embedding-3-large"


def test_settings_treat_blank_required_env_as_missing(monkeypatch):
    monkeypatch.setattr(settings_module, "_load_env", lambda: None)
    for name in ENV_NAMES:
        monkeypatch.setenv(name, "")
    settings_module.get_settings.cache_clear()

    settings = settings_module.get_settings()

    assert settings.superadmin_username == "superadmin"
    assert settings.model_provider_base_url == "https://api.openai.com/v1"
    assert settings.model_provider_model == "gpt-4o-mini"
    assert settings.embedding_api_key is None
