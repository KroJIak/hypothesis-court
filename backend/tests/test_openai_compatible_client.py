import json
from urllib.error import HTTPError

import pytest

from app.services.exceptions import ValidationError
from app.services.openai_compatible_client import OpenAICompatibleClient


class _ErrorBody:
    def read(self) -> bytes:
        return b'{"error":"blocked"}'

    def close(self) -> None:
        pass


class _JsonResponse:
    def __init__(self, payload: dict):
        self._payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return None

    def read(self) -> bytes:
        return json.dumps(self._payload).encode("utf-8")


def _raise_http_error(code: int):
    def _raiser(*args, **kwargs):
        raise HTTPError(
            url="https://provider.example/chat/completions",
            code=code,
            msg="provider error",
            hdrs={},
            fp=_ErrorBody(),
        )

    return _raiser


def test_provider_401_is_mapped_to_api_token_rejection(monkeypatch):
    monkeypatch.setattr("app.services.openai_compatible_client.urlopen", _raise_http_error(401))
    client = OpenAICompatibleClient(base_url="https://provider.example", api_token="token")

    with pytest.raises(ValidationError, match="API-ключ"):
        client.create_chat_completion(model="model", messages=[{"role": "user", "content": "test"}])


def test_provider_403_is_mapped_to_model_access_rejection(monkeypatch):
    monkeypatch.setattr("app.services.openai_compatible_client.urlopen", _raise_http_error(403))
    client = OpenAICompatibleClient(base_url="https://provider.example", api_token="token")

    with pytest.raises(ValidationError, match="модели"):
        client.create_chat_completion(model="model", messages=[{"role": "user", "content": "test"}])


def test_chat_completions_mode_uses_chat_completions_endpoint(monkeypatch):
    requests = []

    def _fake_urlopen(request, timeout):
        requests.append((request, timeout))
        return _JsonResponse({"choices": [{"message": {"content": "ok"}}]})

    monkeypatch.setattr("app.services.openai_compatible_client.urlopen", _fake_urlopen)
    client = OpenAICompatibleClient(base_url="https://provider.example/v1", api_token="token")

    result = client.create_text_completion(
        api_mode="chat_completions",
        model="model",
        messages=[{"role": "user", "content": "test"}],
    )

    assert result == "ok"
    request, _timeout = requests[0]
    assert request.full_url == "https://provider.example/v1/chat/completions"
    assert json.loads(request.data.decode("utf-8"))["messages"] == [{"role": "user", "content": "test"}]


def test_responses_mode_uses_responses_endpoint(monkeypatch):
    requests = []

    def _fake_urlopen(request, timeout):
        requests.append((request, timeout))
        return _JsonResponse({"output_text": "ok"})

    monkeypatch.setattr("app.services.openai_compatible_client.urlopen", _fake_urlopen)
    client = OpenAICompatibleClient(base_url="https://provider.example/v1", api_token="token")

    result = client.create_text_completion(
        api_mode="responses",
        model="model",
        messages=[
            {"role": "system", "content": "system rules"},
            {"role": "user", "content": "test"},
        ],
    )

    assert result == "ok"
    request, _timeout = requests[0]
    body = json.loads(request.data.decode("utf-8"))
    assert request.full_url == "https://provider.example/v1/responses"
    assert body["instructions"] == "system rules"
    assert body["input"] == [{"role": "user", "content": "test"}]
