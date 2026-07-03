class ServiceError(Exception):
    status_code = 400
    detail = "Service error"

    def __init__(self, detail: str | None = None) -> None:
        super().__init__(detail or self.detail)
        self.detail = detail or self.detail


class AuthenticationError(ServiceError):
    status_code = 401
    detail = "Authentication failed"


class AuthorizationError(ServiceError):
    status_code = 403
    detail = "Operation is not allowed"


class NotFoundError(ServiceError):
    status_code = 404
    detail = "Resource not found"


class ConflictError(ServiceError):
    status_code = 409
    detail = "Conflict"


class ValidationError(ServiceError):
    status_code = 422
    detail = "Validation failed"
