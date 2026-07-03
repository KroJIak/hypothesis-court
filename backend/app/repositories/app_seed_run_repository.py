from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.app_seed_run import AppSeedRun


class AppSeedRunRepository:
    def get_by_key(self, session: Session, seed_key: str) -> AppSeedRun | None:
        stmt = select(AppSeedRun).where(AppSeedRun.seed_key == seed_key)
        return session.execute(stmt).scalar_one_or_none()

    def create(self, session: Session, seed_run: AppSeedRun) -> AppSeedRun:
        session.add(seed_run)
        session.flush()
        return seed_run
