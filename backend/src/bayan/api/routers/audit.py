"""Audit routes: `GET /v1/couples/{id}/audit` and `GET /v1/audit/verify`.

Chain verification: staff, the programme operator and the judge get the full answer; a couple member gets a reduced one (chain ok and the number of audit events of their own couple), so no cross-couple volume or hash is disclosed. The chain is SHA-256 hash-linked (`bayan.governance.audit` documents the canonical form). Verifying
shows integrity of the chain as stored; it does not detect truncation of the tail unless the head
hash is anchored elsewhere (ADR 0125)."""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Request

from bayan.core.contracts import Frozen
from bayan.core.types import Principal, Role
from bayan.governance.deps import CurrentPrincipal, GovernanceDep, guard_couple, require_roles
from bayan.governance.models import AuditVerification
from bayan.governance.schemas import AuditResponse

router = APIRouter(prefix="/v1", tags=["audit"])

VerifyReader = Annotated[
    Principal,
    Depends(
        require_roles(
            Role.COUPLE_MEMBER, Role.COUNSELLOR, Role.CLINICIAN, Role.PROGRAMME, Role.JUDGE
        )
    ),
]


@router.get("/couples/{couple_id}/audit", response_model=AuditResponse)
def couple_audit(
    couple_id: str, request: Request, principal: CurrentPrincipal, governance: GovernanceDep
) -> AuditResponse:
    guard_couple(request, principal, couple_id, governance)
    return AuditResponse(
        couple_id=couple_id, events=governance.audit_events_for(principal, couple_id)
    )


class AuditVerificationView(Frozen):
    """Role-aware chain check. Couple members see only `ok` and their own couple's event count."""

    scope: Literal["chain", "own_couple"]
    ok: bool
    own_events: int | None = None
    length: int | None = None
    head_hash: str | None = None
    first_bad_index: int | None = None
    problem: str | None = None


@router.get("/audit/verify", response_model=AuditVerificationView)
def verify_chain(principal: VerifyReader, governance: GovernanceDep) -> AuditVerificationView:
    result: AuditVerification = governance.verify_audit_chain()
    if principal.role is Role.COUPLE_MEMBER:
        own = governance.audit_events_for(principal, principal.couple_id or "")
        return AuditVerificationView(scope="own_couple", ok=result.ok, own_events=len(own))
    return AuditVerificationView(
        scope="chain",
        ok=result.ok,
        length=result.length,
        head_hash=result.head_hash,
        first_bad_index=result.first_bad_index,
        problem=result.problem,
    )
