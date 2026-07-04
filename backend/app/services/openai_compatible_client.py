import json
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from app.services.exceptions import ValidationError

_REQUEST_TIMEOUT_SECONDS = 12


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
        payload = self._request_json("models")
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

    def create_embeddings(self, *, model: str, inputs: list[str]) -> list[list[float]]:
        if not inputs:
            return []
        payload = self._request_json(
            "embeddings",
            method="POST",
            body={"model": model, "input": inputs},
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

    def _request_json(
        self,
        path: str,
        *,
        method: str = "GET",
        body: dict[str, object] | None = None,
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
            with urlopen(request, timeout=_REQUEST_TIMEOUT_SECONDS) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            if exc.code in {401, 403}:
                raise ValidationError("Провайдер отклонил API-ключ") from exc
            raise ValidationError("Не удалось подключиться к провайдеру") from exc
        except (OSError, URLError, json.JSONDecodeError) as exc:
            raise ValidationError("Не удалось подключиться к провайдеру") from exc
