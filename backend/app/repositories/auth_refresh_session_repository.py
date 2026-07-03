import uuid
from datetime import datetime

from sqlalchemy import Select, select, update
from sqlalchemy.orm import Session

from app.models.auth_refresh_session import AuthRefreshSession
from app.models.enums import RefreshRevokeReason


class AuthRefreshSessionRepository:
    def create(self, session: Session, refresh_session: AuthRefreshSession) -> AuthRefreshSession:
        session.add(refresh_session)
        session.flush()
        return refresh_session

    def get_by_hash_for_update(
        self, session: Session, refresh_token_hash: str
    ) -> AuthRefreshSession | None:
        stmt: Select[tuple[AuthRefreshSession]] = (
            select(AuthRefreshSession)
            .where(AuthRefreshSession.refresh_token_hash == refresh_token_hash)
            .with_for_update()
        )
        return session.execute(stmt).scalar_one_or_none()

    def get_by_id_for_update(
        self, session: Session, session_id: uuid.UUID
    ) -> AuthRefreshSession | None:
        stmt: Select[tuple[AuthRefreshSession]] = (
            select(AuthRefreshSession)
            .where(AuthRefreshSession.id == session_id)
            .with_for_update()
        )
        return session.execute(stmt).scalar_one_or_none()

    def revoke_session(
        self,
        refresh_session: AuthRefreshSession,
        *,
        revoked_at: datetime,
        revoked_reason: RefreshRevokeReason,
    ) -> None:
        refresh_session.revoked_at = revoked_at
        refresh_session.revoked_reason = revoked_reason

    def revoke_active_for_user(
        self,
        session: Session,
        *,
        user_id: uuid.UUID,
        revoked_at: datetime,
        revoked_reason: RefreshRevokeReason,
    ) -> None:
        session.execute(
            update(AuthRefreshSession)
            .where(
                AuthRefreshSession.user_id == user_id,
                AuthRefreshSession.revoked_at.is_(None),
            )
            .values(revoked_at=revoked_at, revoked_reason=revoked_reason)
        )

    def revoke_family(
        self,
        session: Session,
        *,
        family_id: uuid.UUID,
        revoked_at: datetime,
        revoked_reason: RefreshRevokeReason,
    ) -> None:
        session.execute(
            update(AuthRefreshSession)
            .where(
                AuthRefreshSession.family_id == family_id,
                AuthRefreshSession.revoked_at.is_(None),
            )
            .values(revoked_at=revoked_at, revoked_reason=revoked_reason)
        )
