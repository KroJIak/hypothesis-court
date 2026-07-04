from app.api.routes.admin import router as admin_router
from app.api.routes.agents import router as agents_router
from app.api.routes.auth import router as auth_router
from app.api.routes.chat_sessions import router as chat_sessions_router
from app.api.routes.health import router as health_router
from app.api.routes.research import router as research_router
from app.api.routes.users import router as users_router

__all__ = [
    "admin_router",
    "agents_router",
    "auth_router",
    "chat_sessions_router",
    "health_router",
    "research_router",
    "users_router",
]
