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
