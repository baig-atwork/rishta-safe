"""Governance-specific domain errors. All derive from `BayanError`, so the API layer maps them to
RFC 9457 problem details without a handler of their own."""

from __future__ import annotations

from bayan.core.errors import BayanError


class GovernanceConfigError(BayanError):
    """The governance service was built with a configuration it refuses to run with."""

    status = 500
    code = "governance_misconfigured"


class TooManyAttempts(BayanError):
    """Too many wrong one-time codes, or too many code requests for one target."""

    status = 429
    code = "too_many_attempts"


class NotConfigured(BayanError):
    """A capability that has no adapter in this deployment (for example OTP delivery in prod)."""

    status = 501
    code = "not_configured"


class AuditFormatError(BayanError):
    """A caller tried to write an audit event that is not in the documented, minimised format."""

    status = 500
    code = "audit_format_error"
