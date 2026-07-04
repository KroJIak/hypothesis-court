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
            raise ValidationError("Selected model is not available from this provider.")
        return models

    def _request_json(self, path: str) -> dict[str, object]:
        headers = {"Accept": "application/json"}
        if self._api_token:
            headers["Authorization"] = f"{self._api_token_prefix} {self._api_token}"
        if self._project_id:
            headers[self._project_header_name] = self._project_id

        request = Request(urljoin(self._base_url, path), headers=headers, method="GET")
        try:
            with urlopen(request, timeout=_REQUEST_TIMEOUT_SECONDS) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            if exc.code in {401, 403}:
                raise ValidationError("Provider rejected the API token.") from exc
            raise ValidationError("Provider connection test failed.") from exc
        except (OSError, URLError, json.JSONDecodeError) as exc:
            raise ValidationError("Provider connection test failed.") from exc
