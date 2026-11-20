"""FastAPI dependencies that other lanes' routers import.

    from bayan.governance.deps import CurrentPrincipal, GovernanceDep, require_roles

    @router.get("/x")
    def x(principal: Annotated[Principal, Depends(require_roles(Role.COUNSELLOR))]): ...

`current_principal` reads `Authorization: Bearer <token>` and raises `Unauthenticated` (401). A
role guard raises `Forbidden` (403) AFTER writing the denial to the audit chain. Both errors are
`BayanError`s, which the app maps to RFC 9457 problem details.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, Request

from bayan.api.deps import assert_couple_access
from bayan.core.errors import Forbidden, Unauthenticated
from bayan.core.types import Principal, Role
from bayan.governance.errors import NotConfigured
from bayan.governance.service import GovernanceService

ANONYMOUS: Principal = Principal(role=Role.EXTERNAL, subject_id="anonymous")


def get_governance(request: Request) -> GovernanceService:
    service = getattr(request.app.state, "governance", None)
    if not isinstance(service, GovernanceService):
        raise NotConfigured(
            "the governance service is not mounted on this app", reason="governance_missing"
        )
    return service


GovernanceDep = Annotated[GovernanceService, Depends(get_governance)]


def bearer_token(request: Request) -> str | None:
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    return token.strip()


def current_principal(request: Request, governance: GovernanceDep) -> Principal:
    token = bearer_token(request)
    if token is None:
        raise Unauthenticated("a bearer token is required", reason="missing_token")
    return governance.authenticate(token)


CurrentPrincipal = Annotated[Principal, Depends(current_principal)]


def optional_principal(request: Request, governance: GovernanceDep) -> Principal:
    """The caller, or the anonymous EXTERNAL principal when there is no valid token. Used only by
    endpoints that refuse unauthenticated and unknown callers anyway (third-party requests)."""
    token = bearer_token(request)
    if token is None:
        return ANONYMOUS
    try:
        return governance.authenticate(token)
    except Unauthenticated:
        return ANONYMOUS


OptionalPrincipal = Annotated[Principal, Depends(optional_principal)]


def require_roles(*roles: Role) -> Callable[[CurrentPrincipal, GovernanceDep], Principal]:
    """Dependency factory: the caller must hold one of `roles`, else audited 403."""
    allowed = frozenset(roles)

    def dependency(principal: CurrentPrincipal, governance: GovernanceDep) -> Principal:
        if principal.role not in allowed:
            governance.record_access_denied(principal, "role_guard")
            raise Forbidden("your role may not use this endpoint", reason="role_not_permitted")
        return principal

    return dependency


def guard_couple(
    request: Request,
    principal: Principal,
    couple_id: str,
    governance: GovernanceService,
    *,
    write: bool = False,
) -> None:
    """Scope a couple-level route with the controller's `assert_couple_access` (member: own couple;
    counsellor and clinician: assigned couples only; judge: read only; programme and external:
    refused) and write every refusal to the audit chain before re-raising it."""
    try:
        assert_couple_access(principal, couple_id, request, write=write)
    except Forbidden:
        governance.record_access_denied(
            principal,
            "couple_scope_write" if write else "couple_scope_read",
            "couple_scope_refused",
            couple_id,
        )
        raise
