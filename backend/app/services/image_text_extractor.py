from pathlib import Path

from app.services.document_text_extractor import ExtractedText
from app.services.exceptions import ValidationError

IMAGE_FILE_KINDS = {"bmp", "jpeg", "jpg", "png", "tif", "tiff", "webp"}
IMAGE_CONTENT_TYPE_PREFIX = "image/"
_MAX_IMAGE_BYTES = 20 * 1024 * 1024
_MAX_OCR_SIDE = 2400
_OCR_LANGUAGES = "rus+eng"


class ImageTextExtractor:
    def extract_with_ocr(self, *, path: Path, vision_error: str | None = None) -> ExtractedText | None:
        if not path.exists():
            raise ValidationError("Файл источника не найден")
        if path.stat().st_size > _MAX_IMAGE_BYTES:
            raise ValidationError("Изображение слишком большое для синхронной OCR-обработки")

        try:
            from PIL import Image, ImageOps, UnidentifiedImageError
            import pytesseract
        except ImportError as exc:
            raise ValidationError("OCR для изображений не установлен") from exc

        try:
            with Image.open(path) as raw_image:
                image = ImageOps.exif_transpose(raw_image)
                image.thumbnail((_MAX_OCR_SIDE, _MAX_OCR_SIDE))
                text = pytesseract.image_to_string(image.convert("RGB"), lang=_OCR_LANGUAGES).strip()
        except UnidentifiedImageError as exc:
            raise ValidationError("Изображение повреждено или имеет неподдерживаемый формат") from exc
        except pytesseract.TesseractError as exc:
            raise ValidationError("OCR не смог обработать изображение") from exc

        if not text:
            return None

        metadata: dict[str, object] = {
            "parser": "image_ocr",
            "ocr_engine": "tesseract",
            "ocr_languages": _OCR_LANGUAGES,
        }
        if vision_error:
            metadata["vision_fallback_reason"] = vision_error[:300]
        return ExtractedText(text=text, metadata=metadata)


def is_supported_image(*, kind: str | None, content_type: str | None) -> bool:
    normalized_kind = (kind or "").lower().lstrip(".")
    normalized_content_type = (content_type or "").lower()
    return normalized_kind in IMAGE_FILE_KINDS or normalized_content_type.startswith(IMAGE_CONTENT_TYPE_PREFIX)
