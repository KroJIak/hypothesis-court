from sqlalchemy import text
from sqlalchemy.orm import Session

from app.schemas.health import HealthResponse


class HealthService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_status(self) -> HealthResponse:
        self._session.execute(text("select 1"))
        return HealthResponse(status="ok", database="ok")
