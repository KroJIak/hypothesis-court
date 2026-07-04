import os
import re
from dataclasses import dataclass
from datetime import timedelta
from functools import lru_cache
from pathlib import Path
from typing import Final

from dotenv import load_dotenv

_DURATION_PATTERN: Final[re.Pattern[str]] = re.compile(r"^(?P<value>\d+)(?P<unit>[smhdw])$")


def _load_env() -> None:
    root_env_path = Path(__file__).resolve().parents[3] / ".env"
    load_dotenv(root_env_path, override=False)


def _parse_csv(raw_value: str) -> tuple[str, ...]:
    return tuple(item.strip() for item in raw_value.split(",") if item.strip())


def _parse_duration(raw_value: str) -> timedelta:
    match = _DURATION_PATTERN.fullmatch(raw_value.strip())
    if match is None:
        raise ValueError(
            "Invalid duration format. Expected values like 15m, 12h, 1d, or 1w."
        )

    value = int(match.group("value"))
    unit = match.group("unit")
    unit_map = {
        "s": "seconds",
        "m": "minutes",
        "h": "hours",
        "d": "days",
        "w": "weeks",
    }
    return timedelta(**{unit_map[unit]: value})


def _parse_non_negative_int(raw_value: str, name: str) -> int:
    try:
        value = int(raw_value)
    except ValueError:
        raise ValueError(f"{name} must be an integer.") from None
    if value < 0:
        raise ValueError(f"{name} must be greater than or equal to 0.")
    return value


def _get_env(name: str, default: str | None = None) -> str:
    value = os.getenv(name, default)
    if value is None:
        raise ValueError(f"Missing required environment variable: {name}")
    return value


@dataclass(frozen=True)
class Settings:
    cors_allow_origins: tuple[str, ...]
    postgres_db: str
    postgres_user: str
    postgres_password: str
    auth_jwt_secret: str
    auth_access_token_ttl: timedelta
    auth_refresh_token_ttl: timedelta
    superadmin_username: str
    superadmin_password: str
    superadmin_first_name: str | None
    superadmin_last_name: str | None
    chat_max_pinned_sessions: int
    session_max_files: int
    model_provider_base_url: str
    model_provider_api_key: str | None
    model_provider_model: str
    model_provider_folder_id: str | None
    embedding_base_url: str
    embedding_api_key: str | None
    embedding_model: str
    embedding_folder_id: str | None
    avatar_upload_max_bytes: int = 5 * 1024 * 1024

    @property
    def database_url(self) -> str:
        return (
            "postgresql+psycopg://"
            f"{self.postgres_user}:{self.postgres_password}"
            f"@postgres:5432/{self.postgres_db}"
        )

    @property
    def uploads_dir(self) -> Path:
        return Path(__file__).resolve().parents[2] / "storage" / "uploads"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    _load_env()
    raw_origins = _get_env(
        "BACKEND_CORS_ALLOW_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    )
    return Settings(
        cors_allow_origins=_parse_csv(raw_origins),
        postgres_db=_get_env("POSTGRES_DB", "hypothesis_court"),
        postgres_user=_get_env("POSTGRES_USER", "hypothesis_court"),
        postgres_password=_get_env("POSTGRES_PASSWORD", "hypothesis_court"),
        auth_jwt_secret=_get_env("AUTH_JWT_SECRET", "change-me-in-local-env"),
        auth_access_token_ttl=_parse_duration(_get_env("AUTH_ACCESS_TOKEN_TTL", "1d")),
        auth_refresh_token_ttl=_parse_duration(
            _get_env("AUTH_REFRESH_TOKEN_TTL", "1w")
        ),
        superadmin_username=_get_env("SUPERADMIN_USERNAME", "superadmin"),
        superadmin_password=_get_env("SUPERADMIN_PASSWORD", "change-me"),
        superadmin_first_name=os.getenv("SUPERADMIN_FIRST_NAME") or None,
        superadmin_last_name=os.getenv("SUPERADMIN_LAST_NAME") or None,
        chat_max_pinned_sessions=_parse_non_negative_int(
            _get_env("CHAT_MAX_PINNED_SESSIONS", "5"),
            "CHAT_MAX_PINNED_SESSIONS",
        ),
        session_max_files=_parse_non_negative_int(
            _get_env("SESSION_MAX_FILES", "100"),
            "SESSION_MAX_FILES",
        ),
        model_provider_base_url=_get_env("MODEL_PROVIDER_BASE_URL"),
        model_provider_api_key=os.getenv("MODEL_PROVIDER_API_KEY") or None,
        model_provider_model=_get_env("MODEL_PROVIDER_MODEL"),
        model_provider_folder_id=os.getenv("MODEL_PROVIDER_FOLDER_ID") or None,
        embedding_base_url=_get_env("EMBEDDING_BASE_URL", "https://api.openai.com/v1"),
        embedding_api_key=os.getenv("EMBEDDING_API_KEY") or None,
        embedding_model=_get_env("EMBEDDING_MODEL", "text-embedding-3-large"),
        embedding_folder_id=os.getenv("EMBEDDING_FOLDER_ID") or None,
    )
