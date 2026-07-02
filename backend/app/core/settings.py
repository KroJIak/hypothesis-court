import os
from dataclasses import dataclass


def _parse_csv(raw_value: str) -> tuple[str, ...]:
    return tuple(
        item.strip()
        for item in raw_value.split(",")
        if item.strip()
    )


@dataclass(frozen=True)
class Settings:
    cors_allow_origins: tuple[str, ...]


def get_settings() -> Settings:
    raw_origins = os.getenv(
        "BACKEND_CORS_ALLOW_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    )
    return Settings(cors_allow_origins=_parse_csv(raw_origins))
