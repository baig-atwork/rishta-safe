"""Consent, right not to know and staff assignment routes.

    GET  /v1/couples/{id}/consents       own records (couple member); all (assigned staff, judge)
    POST /v1/couples/{id}/consents       a couple member grants consent to share THEIR findings
    POST /v1/consents/{id}/revoke        the subject revokes (appends, never deletes)
    PUT/DELETE /v1/couples/{id}/right-not-to-know    declare / withdraw (Decree-Law 49/2023 Art. 9(2))
    POST /v1/couples/{id}/assignments    assign a counsellor or clinician (programme, staff)

The mandatory couple screening is not consent-based (Art. 4(2)(a), 15). Consent governs voluntary
and secondary uses and the sharing of one person's findings.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request, status

from bayan.core.types import Principal, Role
from bayan.governance.deps import CurrentPrincipal, GovernanceDep, guard_couple, require_roles
from bayan.governance.models import ConsentRecord
from bayan.governance.schemas import AssignBody, ConsentListResponse, GrantBody, RntkResponse

router = APIRouter(prefix="/v1", tags=["consent"])

BASIS_NOTE = (
    "Consent records cover voluntary and secondary uses and the sharing of one person's findings. The "
    "mandatory couple screening is not consent-based (Federal Decree-Law 49/2023 Art. 4(2)(a) and 15)."
)
RNTK_NOTE = (
    "A recorded right not to know (Decree-Law 49/2023 Art. 9(2)) withholds results in this app. Where life or "
    "fetal life is threatened an accredited professional is told and makes the statutory disclosure with "
    "counselling."
)

CoupleMember = Annotated[Principal, Depends(require_roles(Role.COUPLE_MEMBER))]
Assigner = Annotated[
    Principal, Depends(require_roles(Role.PROGRAMME, Role.COUNSELLOR, Role.CLINICIAN))
]


@router.get("/couples/{couple_id}/consents", response_model=ConsentListResponse)
def list_consents(
    couple_id: str, request: Request, principal: CurrentPrincipal, governance: GovernanceDep
) -> ConsentListResponse:
    guard_couple(request, principal, couple_id, governance)
    return ConsentListResponse(
        couple_id=couple_id,
        records=governance.consents_for(principal, couple_id),
        basis_note=BASIS_NOTE,
    )


@router.post(
    "/couples/{couple_id}/consents",
    response_model=ConsentRecord,
    status_code=status.HTTP_201_CREATED,
)
def grant_consent(
    couple_id: str,
    body: GrantBody,
    request: Request,
    principal: CoupleMember,
    governance: GovernanceDep,
) -> ConsentRecord:
    guard_couple(request, principal, couple_id, governance, write=True)
    return governance.grant(
        couple_id,
        principal.subject_id,
        body.recipient,
        body.scope,
        body.purpose,
        body.expires_at,
        by=principal,
    )


@router.post("/consents/{consent_id}/revoke", response_model=ConsentRecord)
def revoke_consent(
    consent_id: str, request: Request, principal: CurrentPrincipal, governance: GovernanceDep
) -> ConsentRecord:
    record = governance.get_consent(consent_id)  # NotFound propagates
    guard_couple(request, principal, record.couple_id, governance, write=True)
    return governance.revoke(consent_id, principal)


@router.put("/couples/{couple_id}/right-not-to-know", response_model=RntkResponse)
def declare_right_not_to_know(
    couple_id: str, request: Request, principal: CoupleMember, governance: GovernanceDep
) -> RntkResponse:
    guard_couple(request, principal, couple_id, governance, write=True)
    governance.record_right_not_to_know(couple_id, principal.subject_id, principal)
    return RntkResponse(
        couple_id=couple_id, person_id=principal.subject_id, active=True, note=RNTK_NOTE
    )


@router.delete("/couples/{couple_id}/right-not-to-know", response_model=RntkResponse)
def withdraw_right_not_to_know(
    couple_id: str, request: Request, principal: CoupleMember, governance: GovernanceDep
) -> RntkResponse:
    guard_couple(request, principal, couple_id, governance, write=True)
    governance.withdraw_right_not_to_know(couple_id, principal.subject_id, principal)
    return RntkResponse(
        couple_id=couple_id, person_id=principal.subject_id, active=False, note=RNTK_NOTE
    )


# Care-team assignment is programme-level administration (the programme operator may assign staff to a
# couple it cannot read), so it is role-guarded here and authorised in `GovernanceService.assign_staff`
# (programme, or staff already assigned; never self-assignment; registered staff only) rather than by
# `assert_couple_access`, which refuses the programme role on couple-level records.
@router.post("/couples/{couple_id}/assignments", status_code=status.HTTP_204_NO_CONTENT)
def assign_staff(
    couple_id: str, body: AssignBody, principal: Assigner, governance: GovernanceDep
) -> None:
    governance.assign_staff(couple_id, body.staff_subject_id, principal)
