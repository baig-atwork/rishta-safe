"""Closure endpoints: schema, patient items, clinician proforma, teach-back quiz.

There is no marriage-decision field anywhere (ADR 0143). The comprehension test with people has
not been run; these endpoints serve the instrument only.
"""

from __future__ import annotations

from typing import Annotated, cast

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict

from bayan.api.deps import CurrentPrincipal, assert_couple_access, require_roles
from bayan.core.errors import Forbidden
from bayan.core.types import Locale, Principal, Role
from bayan.journey.models import (
    ClinicianProforma,
    ClosureAnswers,
    ClosureRecord,
    ClosureSchema,
    TeachBackQuiz,
    TeachBackResult,
    TeachBackSubmission,
)
from bayan.journey.service import JourneyService

router = APIRouter(prefix="/v1", tags=["closure"])

Clinical = Annotated[Principal, Depends(require_roles(Role.CLINICIAN, Role.COUNSELLOR))]


class PatientClosureRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    person_id: str
    answers: ClosureAnswers


def _journey(request: Request) -> JourneyService:
    return cast("JourneyService", request.app.state.journey)


@router.get("/closure/schema", response_model=ClosureSchema)
def get_closure_schema(
    request: Request, principal: CurrentPrincipal, locale: Locale = Locale.EN
) -> ClosureSchema:
    """Not couple-scoped: the schema is the same for everyone. Any authenticated caller may read it."""
    del principal
    return _journey(request).closure_schema(locale)


@router.post("/couples/{couple_id}/closure/patient", response_model=ClosureRecord, status_code=201)
def post_patient_closure(
    couple_id: str, body: PatientClosureRequest, request: Request, principal: CurrentPrincipal
) -> ClosureRecord:
    assert_couple_access(principal, couple_id, request, write=True)
    if principal.role is not Role.COUPLE_MEMBER:
        raise Forbidden("Only the person concerned answers the patient items.")
    return _journey(request).submit_patient_closure(
        couple_id, body.person_id, body.answers, principal
    )


@router.post(
    "/couples/{couple_id}/closure/clinician", response_model=ClosureRecord, status_code=201
)
def post_clinician_closure(
    couple_id: str, proforma: ClinicianProforma, request: Request, principal: Clinical
) -> ClosureRecord:
    assert_couple_access(principal, couple_id, request, write=True)
    return _journey(request).submit_clinician_proforma(couple_id, proforma, principal)


@router.get("/couples/{couple_id}/teachback", response_model=TeachBackQuiz)
def get_teachback(
    couple_id: str, request: Request, principal: CurrentPrincipal, locale: Locale = Locale.EN
) -> TeachBackQuiz:
    assert_couple_access(principal, couple_id, request)
    return _journey(request).teachback(couple_id, locale, principal)


@router.post("/couples/{couple_id}/teachback", response_model=TeachBackResult)
def post_teachback(
    couple_id: str, body: TeachBackSubmission, request: Request, principal: CurrentPrincipal
) -> TeachBackResult:
    assert_couple_access(principal, couple_id, request, write=True)
    return _journey(request).submit_teachback(couple_id, body, principal)
