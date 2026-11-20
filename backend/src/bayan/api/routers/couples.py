"""Case record endpoints. Thin: all logic is in `bayan.journey` (services from `app.state.journey`)."""

from __future__ import annotations

from typing import Annotated, cast

from fastapi import APIRouter, Depends, Request

from bayan.api.deps import CurrentPrincipal, assert_couple_access, require_roles
from bayan.core.errors import Forbidden
from bayan.core.types import Principal, Role
from bayan.journey.models import CoupleCase, IntakeInput
from bayan.journey.service import JourneyService

router = APIRouter(prefix="/v1", tags=["cases"])

# One place per router decides who may do what, so guarding is a one-line change.
CaseCreator = Annotated[Principal, Depends(require_roles(Role.CLINICIAN, Role.COUNSELLOR))]
CaseLister = Annotated[
    Principal, Depends(require_roles(Role.CLINICIAN, Role.COUNSELLOR, Role.JUDGE))
]


def _journey(request: Request) -> JourneyService:
    return cast("JourneyService", request.app.state.journey)


@router.post("/couples", response_model=CoupleCase, status_code=201)
def create_couple(intake: IntakeInput, request: Request, principal: CaseCreator) -> CoupleCase:
    """Register a synthetic couple (a simulated booking at a licensed centre).

    Not couple-scoped: the couple does not exist yet. Care-team assignment is made by governance.
    """
    del principal
    return _journey(request).create_case(intake)


@router.get("/couples", response_model=tuple[CoupleCase, ...])
def list_couples(request: Request, principal: CaseLister) -> tuple[CoupleCase, ...]:
    """Staff see only the couples they are assigned to (fail closed); a judge sees all synthetic cases."""
    cases = _journey(request).list_cases()
    if principal.role is Role.JUDGE:
        return cases
    governance = getattr(request.app.state, "governance", None)
    if governance is None:
        raise Forbidden("Care-team assignment could not be checked.")
    return tuple(c for c in cases if principal.subject_id in governance.assigned_staff(c.couple_id))


@router.get("/couples/{couple_id}", response_model=CoupleCase)
def get_couple(couple_id: str, request: Request, principal: CurrentPrincipal) -> CoupleCase:
    assert_couple_access(principal, couple_id, request)
    return _journey(request).get_case(couple_id)
