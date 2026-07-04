import copy

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import (
    get_swagger_ui_html,
    get_swagger_ui_oauth2_redirect_html,
)
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import agents_router, admin_router, auth_router, chat_sessions_router, health_router, users_router
from app.core.middleware import ForwardedPrefixMiddleware
from app.core.settings import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    app = FastAPI(
        title="Hypothesis Court API",
        version="0.1.0",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    app.add_middleware(ForwardedPrefixMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_allow_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(users_router)
    app.include_router(admin_router)
    app.include_router(agents_router)
    app.include_router(chat_sessions_router)
    app.mount("/uploads", StaticFiles(directory=settings.uploads_dir), name="uploads")
    register_documentation_routes(app)
    return app


def register_documentation_routes(app: FastAPI) -> None:
    def get_base_openapi_schema() -> dict[str, object]:
        if not hasattr(app.state, "base_openapi_schema"):
            app.state.base_openapi_schema = get_openapi(
                title=app.title,
                version=app.version,
                routes=app.routes,
            )

        return app.state.base_openapi_schema

    @app.get("/openapi.json", include_in_schema=False)
    def openapi_schema(request: Request):
        schema = copy.deepcopy(get_base_openapi_schema())
        root_path = request.scope.get("root_path", "").rstrip("/")
        schema["servers"] = [{"url": root_path or "/"}]
        return JSONResponse(schema)

    @app.get("/docs", include_in_schema=False)
    def swagger_ui(request: Request):
        root_path = request.scope.get("root_path", "").rstrip("/")
        return get_swagger_ui_html(
            openapi_url=f"{root_path}/openapi.json" if root_path else "/openapi.json",
            title=f"{app.title} - Swagger UI",
            oauth2_redirect_url=(
                f"{root_path}/docs/oauth2-redirect"
                if root_path
                else "/docs/oauth2-redirect"
            ),
        )

    @app.get("/docs/oauth2-redirect", include_in_schema=False)
    def swagger_ui_redirect():
        return get_swagger_ui_oauth2_redirect_html()


app = create_app()
