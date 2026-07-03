import uuid
from pathlib import Path

from fastapi import UploadFile

from app.services.exceptions import ValidationError

_ALLOWED_SIGNATURES: tuple[tuple[bytes, str], ...] = (
    (b"\xff\xd8\xff", ".jpg"),
    (b"\x89PNG\r\n\x1a\n", ".png"),
    (b"RIFF", ".webp"),
    (b"GIF87a", ".gif"),
    (b"GIF89a", ".gif"),
)


class AvatarStorage:
    def __init__(self, uploads_dir: Path, max_bytes: int) -> None:
        self._uploads_dir = uploads_dir
        self._max_bytes = max_bytes

    async def save(self, file: UploadFile) -> str:
        content_type = file.content_type or ""
        if not content_type.startswith("image/"):
            raise ValidationError("Avatar must be an image file.")

        data = await file.read(self._max_bytes + 1)
        if not data:
            raise ValidationError("Avatar file is empty.")
        if len(data) > self._max_bytes:
            raise ValidationError("Avatar file is too large.")

        suffix = self._detect_suffix(data)
        object_key = f"avatars/{uuid.uuid4().hex}{suffix}"
        target_path = self._uploads_dir / object_key
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_bytes(data)
        return object_key

    def delete(self, object_key: str | None) -> None:
        if not object_key:
            return

        path = self._uploads_dir / object_key
        try:
            if path.is_file():
                path.unlink()
        except OSError:
            return

    @staticmethod
    def _detect_suffix(data: bytes) -> str:
        for signature, suffix in _ALLOWED_SIGNATURES:
            if data.startswith(signature):
                if suffix == ".webp" and data[8:12] != b"WEBP":
                    continue
                return suffix
        raise ValidationError("Avatar image format is not supported.")
