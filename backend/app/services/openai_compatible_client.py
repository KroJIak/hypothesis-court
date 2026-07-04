import json
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from app.services.exceptions import ValidationError

_MODEL_LIST_TIMEOUT_SECONDS = 12
_GENERATION_TIMEOUT_SECONDS = 120
CHAT_COMPLETIONS_API_MODE = "chat_completions"
RESPONSES_API_MODE = "responses"


class OpenAICompatibleClient:
    def __init__(
        self,
        *,
        base_url: str,
        api_token: str | None,
        project_id: str | None = None,
        api_token_prefix: str = "Bearer",
        project_header_name: str = "OpenAI-Project",
    ) -> None:
        self._base_url = base_url.rstrip("/") + "/"
        self._api_token = api_token
        self._project_id = project_id
        self._api_token_prefix = api_token_prefix
        self._project_header_name = project_header_name

    def list_models(self) -> list[str]:
        payload = self._request_json("models", timeout_seconds=_MODEL_LIST_TIMEOUT_SECONDS)
        raw_models = payload.get("data", [])
        models = [
            item.get("id")
            for item in raw_models
            if isinstance(item, dict) and isinstance(item.get("id"), str)
        ]
        return sorted(set(models), key=str.lower)

    def assert_model_available(self, model: str) -> list[str]:
        models = self.list_models()
        if models and model not in models:
            raise ValidationError("Выбранная модель недоступна у этого провайдера")
        return models

    def create_chat_completion(
        self,
        *,
        model: str,
        messages: list[dict[str, str]],
        temperature: float = 0.2,
        response_format: dict[str, object] | None = None,
    ) -> str:
        body: dict[str, object] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
        }
        if response_format is not None:
            body["response_format"] = response_format
        payload = self._request_json(
            "chat/completions",
            method="POST",
            body=body,
            timeout_seconds=_GENERATION_TIMEOUT_SECONDS,
        )
        choices = payload.get("choices", [])
        if not isinstance(choices, list) or not choices:
            raise ValidationError("Провайдер вернул пустой ответ")
        first_choice = choices[0]
        if not isinstance(first_choice, dict):
            raise ValidationError("Провайдер вернул некорректный ответ")
        message = first_choice.get("message")
        if not isinstance(message, dict) or not isinstance(message.get("content"), str):
            raise ValidationError("Провайдер вернул некорректный ответ")
        return message["content"]

    def create_response(
        self,
        *,
        model: str,
        messages: list[dict[str, str]],
        temperature: float = 0.2,
        response_format: dict[str, object] | None = None,
    ) -> str:
        system_messages = [
            str(message.get("content", "")).strip()
            for message in messages
            if message.get("role") == "system" and str(message.get("content", "")).strip()
        ]
        input_messages = [
            {
                "role": message.get("role", "user"),
                "content": str(message.get("content", "")),
            }
            for message in messages
            if message.get("role") != "system"
        ]
        body: dict[str, object] = {
            "model": model,
            "input": input_messages,
            "temperature": temperature,
        }
        if system_messages:
            body["instructions"] = "\n\n".join(system_messages)
        if response_format is not None:
            body["text"] = {"format": response_format}

        payload = self._request_json(
            "responses",
            method="POST",
            body=body,
            timeout_seconds=_GENERATION_TIMEOUT_SECONDS,
        )
        content = self._extract_response_text(payload)
        if not content:
            raise ValidationError("Провайдер вернул пустой ответ")
        return content

    def create_text_completion(
        self,
        *,
        api_mode: str,
        model: str,
        messages: list[dict[str, str]],
        temperature: float = 0.2,
        response_format: dict[str, object] | None = None,
    ) -> str:
        if api_mode == RESPONSES_API_MODE:
            return self.create_response(
                model=model,
                messages=messages,
                temperature=temperature,
                response_format=response_format,
            )
        if api_mode == CHAT_COMPLETIONS_API_MODE:
            return self.create_chat_completion(
                model=model,
                messages=messages,
                temperature=temperature,
                response_format=response_format,
            )
        raise ValidationError("Неизвестный режим API провайдера")

    def assert_text_generation_available(self, *, model: str, api_mode: str) -> list[str]:
        models = self.assert_model_available(model)
        self.create_text_completion(
            api_mode=api_mode,
            model=model,
            messages=[
                {"role": "system", "content": "Ответь одним коротким словом."},
                {"role": "user", "content": "Проверка подключения"},
            ],
            temperature=0,
        )
        return models

    def create_embeddings(self, *, model: str, inputs: list[str]) -> list[list[float]]:
        if not inputs:
            return []
        payload = self._request_json(
            "embeddings",
            method="POST",
            body={"model": model, "input": inputs},
            timeout_seconds=_GENERATION_TIMEOUT_SECONDS,
        )
        raw_items = payload.get("data")
        if not isinstance(raw_items, list):
            raise ValidationError("Провайдер вернул некорректные эмбеддинги")
        embeddings_by_index: dict[int, list[float]] = {}
        for raw_item in raw_items:
            if not isinstance(raw_item, dict):
                raise ValidationError("Провайдер вернул некорректные эмбеддинги")
            index = raw_item.get("index")
            embedding = raw_item.get("embedding")
            if not isinstance(index, int) or not isinstance(embedding, list):
                raise ValidationError("Провайдер вернул некорректные эмбеддинги")
            vector: list[float] = []
            for value in embedding:
                if not isinstance(value, int | float):
                    raise ValidationError("Провайдер вернул некорректные эмбеддинги")
                vector.append(float(value))
            if not vector:
                raise ValidationError("Провайдер вернул пустой эмбеддинг")
            embeddings_by_index[index] = vector
        try:
            return [embeddings_by_index[index] for index in range(len(inputs))]
        except KeyError as exc:
            raise ValidationError("Провайдер вернул неполный набор эмбеддингов") from exc

    @staticmethod
    def _extract_response_text(payload: dict[str, object]) -> str:
        output_text = payload.get("output_text")
        if isinstance(output_text, str):
            return output_text

        output = payload.get("output")
        if not isinstance(output, list):
            return ""

        chunks: list[str] = []
        for item in output:
            if not isinstance(item, dict):
                continue
            content = item.get("content")
            if not isinstance(content, list):
                continue
            for content_item in content:
                if not isinstance(content_item, dict):
                    continue
                text = content_item.get("text")
                if isinstance(text, str):
                    chunks.append(text)
        return "\n".join(chunks).strip()

    def _request_json(
        self,
        path: str,
        *,
        method: str = "GET",
        body: dict[str, object] | None = None,
        timeout_seconds: int = _MODEL_LIST_TIMEOUT_SECONDS,
    ) -> dict[str, object]:
        headers = {"Accept": "application/json"}
        if self._api_token:
            headers["Authorization"] = f"{self._api_token_prefix} {self._api_token}"
        if self._project_id:
            headers[self._project_header_name] = self._project_id

        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode("utf-8")

        request = Request(urljoin(self._base_url, path), data=data, headers=headers, method=method)
        try:
            with urlopen(request, timeout=timeout_seconds) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            if exc.code == 401:
                raise ValidationError("Провайдер отклонил API-ключ") from exc
            if exc.code == 403:
                raise ValidationError("Провайдер запретил запрос к выбранной модели") from exc
            raise ValidationError("Не удалось подключиться к провайдеру") from exc
        except (OSError, URLError, json.JSONDecodeError) as exc:
            raise ValidationError("Не удалось подключиться к провайдеру") from exc
