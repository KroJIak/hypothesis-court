import uuid
from pathlib import Path

from fastapi import UploadFile

from app.services.exceptions import ValidationError

_CHUNK_SIZE = 1024 * 1024


class SessionFileStorage:
    def __init__(self, uploads_dir: Path, max_bytes: int) -> None:
        self._uploads_dir = uploads_dir
        self._max_bytes = max_bytes

    async def save(self, *, chat_session_id: uuid.UUID, file: UploadFile) -> tuple[str, int]:
        filename = self.normalize_filename(file.filename)
        suffix = Path(filename).suffix.lower()
        object_key = f"session-files/{chat_session_id}/{uuid.uuid4().hex}{suffix}"
        target_path = self._uploads_dir / object_key
        target_path.parent.mkdir(parents=True, exist_ok=True)

        size_bytes = 0
        try:
            with target_path.open("wb") as target_file:
                while chunk := await file.read(_CHUNK_SIZE):
                    size_bytes += len(chunk)
                    if size_bytes > self._max_bytes:
                        raise ValidationError(f"Session file is too large. Maximum size is {self._max_bytes} bytes.")
                    target_file.write(chunk)
        except OSError as exc:
            self.delete(object_key)
            raise ValidationError("Could not save session file.") from exc
        except ValidationError:
            self.delete(object_key)
            raise

        if size_bytes == 0:
            self.delete(object_key)
            raise ValidationError("File is empty.")

        return object_key, size_bytes

    def delete(self, object_key: str | None) -> bool:
        if not object_key:
            return True

        path = self._uploads_dir / object_key
        try:
            if path.is_file():
                path.unlink()
            return True
        except OSError:
            return False

    @staticmethod
    def normalize_filename(filename: str | None) -> str:
        normalized = (filename or "").strip()
        if not normalized:
            raise ValidationError("File name cannot be empty.")
        if len(normalized) > 255:
            raise ValidationError("File name must contain at most 255 characters.")
        return normalized

    @staticmethod
    def detect_kind(filename: str) -> str | None:
        suffix = Path(filename).suffix.lower().lstrip(".")
        return suffix[:32] or None
