from collections.abc import Awaitable, Callable

from starlette.types import ASGIApp, Message, Receive, Scope, Send


class ForwardedPrefixMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in {"http", "websocket"}:
            await self.app(scope, receive, send)
            return

        root_path = _read_forwarded_prefix(scope)

        if root_path is None:
            await self.app(scope, receive, send)
            return

        next_scope = dict(scope)
        next_scope["root_path"] = root_path
        await self.app(next_scope, receive, send)


def _read_forwarded_prefix(scope: Scope) -> str | None:
    for raw_name, raw_value in scope.get("headers", []):
        if raw_name.lower() != b"x-forwarded-prefix":
            continue

        forwarded_prefix = raw_value.decode("utf-8").strip()

        if not forwarded_prefix or forwarded_prefix == "/":
            return None

        normalized_prefix = forwarded_prefix.rstrip("/")
        return normalized_prefix if normalized_prefix.startswith("/") else f"/{normalized_prefix}"

    return None
