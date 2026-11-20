"""Shared FastAPI dependencies: the authenticated principal and role guards.

Controller-owned. Authentication itself lives in governance (`GovernanceService.authenticate`);
this module only reads the bearer token and delegates, so routers of every lane guard the same way.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, Request

from bayan.core.errors import Forbidden, Unauthenticated
from bayan.core.types import Principal, Role


def _bearer(request: Request) -> str | None:
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() == "bearer" and token:
        return token.strip()
    return None


def get_optional_principal(request: Request) -> Principal | None:
    token = _bearer(request)
    if token is None:
        return None
    return request.app.state.governance.authenticate(token)  # type: ignore[no-any-return]


def get_principal(request: Request) -> Principal:
    principal = get_optional_principal(request)
    if principal is None:
        raise Unauthenticated("A bearer token is required.")
    return principal


CurrentPrincipal = Annotated[Principal, Depends(get_principal)]


def require_roles(*roles: Role) -> Callable[[Principal], Principal]:
    allowed = frozenset(roles)

    def guard(principal: CurrentPrincipal) -> Principal:
        if principal.role not in allowed:
            raise Forbidden(f"Role {principal.role.value} may not do this.")
        return principal

    return guard


def assert_couple_access(
    principal: Principal,
    couple_id: str,
    request: Request | None = None,
    *,
    write: bool = False,
) -> None:
    """Scope a couple-level route to the caller.

    - A couple member reaches only their own couple.
    - Counsellors and clinicians reach only couples they are assigned to (governance care-team
      assignment). Pass `request` so the assignment can be read; without it the check is
      refused for staff (fail closed).
    - A judge may read synthetic cases but never write.
    - The programme operator and external parties have no access to individual couple records.
    """
    role = principal.role
    if role is Role.COUPLE_MEMBER:
        if principal.couple_id != couple_id:
            raise Forbidden("This record belongs to another couple.")
        return
    if role is Role.JUDGE:
        if write:
            raise Forbidden("The judge role is read-only.")
        return
    if role in (Role.COUNSELLOR, Role.CLINICIAN):
        if request is None:
            raise Forbidden("Care-team assignment could not be checked.")
        assigned = request.app.state.governance.assigned_staff(couple_id)
        if principal.subject_id not in assigned:
            raise Forbidden("You are not assigned to this couple.")
        return
    raise Forbidden("This role has no access to individual couple records.")
