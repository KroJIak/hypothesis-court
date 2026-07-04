from enum import Enum


class UserStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    DELETED = "deleted"


class RefreshRevokeReason(str, Enum):
    LOGOUT = "logout"
    LOGOUT_ALL = "logout_all"
    PASSWORD_CHANGED = "password_changed"
    ADMIN_RESET = "admin_reset"
    ADMIN_DELETE = "admin_delete"
    ROTATION_REPLACED = "rotation_replaced"
    REUSE_DETECTED = "reuse_detected"


class AuditEventType(str, Enum):
    USER_CREATED = "user_created"
    USER_UPDATED = "user_updated"
    USER_DELETED = "user_deleted"
    PASSWORD_CHANGED = "password_changed"
    PASSWORD_RESET = "password_reset"
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILED = "login_failed"
    LOGOUT = "logout"
    LOGOUT_ALL = "logout_all"
    REFRESH_ROTATED = "refresh_rotated"
    REFRESH_REUSE_DETECTED = "refresh_reuse_detected"


class ResearchRunStatus(str, Enum):
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ResearchRunTrigger(str, Enum):
    INITIAL = "initial"
    EDIT = "edit"
    REGENERATE = "regenerate"


class ResearchRunStage(str, Enum):
    QUEUED = "queued"
    INGESTION = "ingestion"
    RETRIEVAL = "retrieval"
    EVIDENCE = "evidence"
    HYPOTHESIS_GENERATION = "hypothesis_generation"
    DEBATE = "debate"
    EVALUATION = "evaluation"
    JUDGE = "judge"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ResearchFeedbackTarget(str, Enum):
    RUN = "run"
    HYPOTHESIS = "hypothesis"
    VERDICT = "verdict"


class ResearchFeedbackOutcome(str, Enum):
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    NEEDS_MORE_DATA = "needs_more_data"
    UNKNOWN = "unknown"


class ResearchInputKind(str, Enum):
    KPI = "kpi"
    CONSTRAINTS = "constraints"
    CONTEXT = "context"
    CUSTOM = "custom"


class DocumentProcessingStatus(str, Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    PARSING = "parsing"
    CHUNKED = "chunked"
    INDEXED = "indexed"
    PROCESSED = "processed"
    FAILED = "failed"
    UNSUPPORTED = "unsupported"


class EvidenceKind(str, Enum):
    SUPPORT = "support"
    CONTRADICTION = "contradiction"
    RISK = "risk"
    CONSTRAINT = "constraint"
    UNKNOWN = "unknown"


class EvidenceRelationKind(str, Enum):
    SUPPORTS = "supports"
    CONTRADICTS = "contradicts"
    RISK = "risk"
    CONSTRAINS = "constrains"


class DebateRole(str, Enum):
    DEFENDER = "defender"
    ATTACKER = "attacker"
    MANUFACTURER = "manufacturer"
