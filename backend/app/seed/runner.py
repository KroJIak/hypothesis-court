import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.app_seed_run import AppSeedRun
from app.repositories.app_seed_run_repository import AppSeedRunRepository


@dataclass(frozen=True)
class SeedDocument:
    seed_key: str
    handler: str
    payload: dict[str, object]
    checksum: str


def _load_seed_document(path: Path) -> SeedDocument:
    raw_bytes = path.read_bytes()
    raw_data = json.loads(raw_bytes.decode("utf-8"))
    return SeedDocument(
        seed_key=str(raw_data["seed_key"]),
        handler=str(raw_data["handler"]),
        payload=dict(raw_data.get("payload", {})),
        checksum=hashlib.sha256(raw_bytes).hexdigest(),
    )


def apply_seed_files(session: Session, seeds_root: Path) -> None:
    repository = AppSeedRunRepository()
    for seed_path in sorted(seeds_root.rglob("*.json")):
        document = _load_seed_document(seed_path)
        if repository.get_by_key(session, document.seed_key) is not None:
            continue

        if document.handler != "record_only":
            raise ValueError(f"Unsupported seed handler: {document.handler}")

        try:
            repository.create(
                session,
                AppSeedRun(
                    seed_key=document.seed_key,
                    checksum=document.checksum,
                    payload={
                        "handler": document.handler,
                        "payload": document.payload,
                        "source": str(seed_path.relative_to(seeds_root)),
                    },
                ),
            )
            session.commit()
        except Exception:
            session.rollback()
            raise
