import re

from app.services.exceptions import ValidationError

USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9._-]{3,64}$")


def normalize_username(username: str) -> str:
    normalized = username.strip()
    if not USERNAME_PATTERN.fullmatch(normalized):
        raise ValidationError(
            "Username must be 3-64 characters long and contain only letters, digits, dot, underscore, or hyphen."
        )
    return normalized


def normalize_optional_name(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    if not normalized:
        raise ValidationError("Name fields cannot be empty strings.")
    return normalized


def validate_password(password: str) -> None:
    if len(password) < 8:
        raise ValidationError("Password must contain at least 8 characters.")
    if password.strip() != password:
        raise ValidationError("Password cannot start or end with spaces.")
