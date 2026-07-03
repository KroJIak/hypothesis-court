from sqlalchemy.orm import Session

from app.models.audit_event import AuditEvent


class AuditRepository:
    def create(self, session: Session, event: AuditEvent) -> AuditEvent:
        session.add(event)
        session.flush()
        return event
