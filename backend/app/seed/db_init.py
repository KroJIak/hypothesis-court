import time
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import text

from app.core.settings import get_settings
from app.db.session import SessionLocal, engine
from app.repositories.user_repository import UserRepository
from app.seed.runner import apply_seed_files
from app.services.bootstrap_service import BootstrapService

DB_INIT_TIMEOUT_SECONDS = 60


def wait_for_database(timeout_seconds: int) -> None:
    deadline = time.monotonic() + timeout_seconds
    while True:
        try:
            with engine.connect() as connection:
                connection.execute(text("select 1"))
            return
        except Exception:
            if time.monotonic() >= deadline:
                raise
            time.sleep(2)


def ensure_extensions() -> None:
    with engine.begin() as connection:
        connection.execute(text("create extension if not exists citext"))
        connection.execute(text("create extension if not exists pgcrypto"))


def run_migrations() -> None:
    config = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", get_settings().database_url)
    command.upgrade(config, "head")


def bootstrap_superadmin() -> None:
    settings = get_settings()
    with SessionLocal() as session:
        BootstrapService(
            session=session,
            settings=settings,
            user_repository=UserRepository(),
        ).ensure_superadmin()


def run_seed_files() -> None:
    seeds_root = Path(__file__).resolve().parents[2] / "seeds"
    with SessionLocal() as session:
        apply_seed_files(session, seeds_root)


def main() -> None:
    wait_for_database(DB_INIT_TIMEOUT_SECONDS)
    ensure_extensions()
    run_migrations()
    bootstrap_superadmin()
    run_seed_files()


if __name__ == "__main__":
    main()
