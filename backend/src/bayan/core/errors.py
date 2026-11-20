"""Domain errors, mapped to RFC 9457 problem details by the API layer."""

from __future__ import annotations


class BayanError(Exception):
    """Base class. `status` is the HTTP status the API layer uses; `code` is a stable slug."""

    status: int = 500
    code: str = "internal_error"

    def __init__(self, detail: str = "", **extra: object) -> None:
        super().__init__(detail or self.code)
        self.detail = detail or self.code
        self.extra = extra


class NotFound(BayanError):
    status = 404
    code = "not_found"


class Forbidden(BayanError):
    """Authenticated but not allowed. Always logged to the audit chain by the caller."""

    status = 403
    code = "forbidden"


class Unauthenticated(BayanError):
    status = 401
    code = "unauthenticated"


class Conflict(BayanError):
    status = 409
    code = "conflict"


class Invalid(BayanError):
    status = 422
    code = "invalid"


class RuleViolation(BayanError):
    """A product rule refused the action (for example a banned wording or a missing consent)."""

    status = 422
    code = "rule_violation"
