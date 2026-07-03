import uuid

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.models.enums import UserStatus
from app.models.user import User


class UserRepository:
    def get_by_id(self, session: Session, user_id: uuid.UUID) -> User | None:
        return session.get(User, user_id)

    def get_by_username(self, session: Session, username: str) -> User | None:
        stmt = select(User).where(User.username == username)
        return session.execute(stmt).scalar_one_or_none()

    def create(self, session: Session, user: User) -> User:
        session.add(user)
        session.flush()
        return user

    def list_users(
        self,
        session: Session,
        *,
        search: str | None,
        is_admin: bool | None,
        status: UserStatus | None,
        limit: int,
        offset: int,
    ) -> tuple[list[User], int]:
        stmt: Select[tuple[User]] = select(User)

        if search:
            stmt = stmt.where(User.username.ilike(f"%{search}%"))
        if is_admin is not None:
            stmt = stmt.where(User.is_admin.is_(is_admin))
        if status is not None:
            stmt = stmt.where(User.status == status)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = session.execute(count_stmt).scalar_one()
        items = session.execute(
            stmt.order_by(User.created_at.desc()).offset(offset).limit(limit)
        ).scalars().all()
        return items, total
