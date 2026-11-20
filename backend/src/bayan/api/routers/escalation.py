"""Escalation routes.

    POST /v1/couples/{id}/escalations/evaluate   staff assigned to the couple: run the triggers
    GET  /v1/escalations                         the counsellor queue (staff; judge sees synthetic cases)

The evaluate route reads the couple's reports from `app.state.journey` (`reports`) and the result
from `app.state.genetics` (`compute_couple_result`), the exact names of spec section 3.1. If those
services are not mounted it answers 501, it does not guess. `GET /v1/couples/{id}/brief` belongs to
the composition lane.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Annotated, Protocol, runtime_checkable

from fastapi import APIRouter, Depends, Request

from bayan.core.contracts import CoupleResult, PersonReport
from bayan.core.types import Principal, Relationship, Role
from bayan.governance.deps import GovernanceDep, guard_couple, require_roles
from bayan.governance.errors import NotConfigured
from bayan.governance.escalation import context_from_reports
from bayan.governance.schemas import (
    EscalationEvaluateBody,
    EscalationEvaluateResponse,
    EscalationQueueResponse,
)

router = APIRouter(prefix="/v1", tags=["escalation"])

Staff = Annotated[Principal, Depends(require_roles(Role.COUNSELLOR, Role.CLINICIAN))]
QueueReader = Annotated[
    Principal, Depends(require_roles(Role.COUNSELLOR, Role.CLINICIAN, Role.JUDGE))
]


@runtime_checkable
class _ReportsSource(Protocol):
    def reports(self, couple_id: str) -> Sequence[PersonReport]: ...


@runtime_checkable
class _ResultSource(Protocol):
    def compute_couple_result(
        self, couple_id: str, reports: Sequence[PersonReport], relationship: Relationship
    ) -> CoupleResult: ...


def _lane(request: Request, name: str) -> object:
    service = getattr(request.app.state, name, None)
    if service is None:
        raise NotConfigured(
            f"the {name} service is not mounted on this app", reason=f"{name}_missing"
        )
    return service


@router.post("/couples/{couple_id}/escalations/evaluate", response_model=EscalationEvaluateResponse)
def evaluate_escalation(
    couple_id: str,
    body: EscalationEvaluateBody,
    request: Request,
    principal: Staff,
    governance: GovernanceDep,
) -> EscalationEvaluateResponse:
    guard_couple(request, principal, couple_id, governance, write=True)
    journey = _lane(request, "journey")
    genetics = _lane(request, "genetics")
    if not isinstance(journey, _ReportsSource) or not isinstance(genetics, _ResultSource):
        raise NotConfigured(
            "the journey or genetics service does not expose the expected methods",
            reason="lane_contract",
        )
    reports = tuple(journey.reports(couple_id))
    result = genetics.compute_couple_result(couple_id, reports, body.relationship)
    ctx = context_from_reports(
        couple_id,
        reports,
        result,
        severity_a_condition_ids=body.severity_a_condition_ids,
        penetrance_gene_symbols=body.penetrance_gene_symbols,
        locale=body.locale,
        free_text=body.free_text,
        pregnancy_in_progress=body.pregnancy_in_progress,
        family_history_recessive=body.family_history_recessive,
        reclassification_notice=body.reclassification_notice,
        non_targeted_finding=body.non_targeted_finding,
        copy_number_or_non_snv=body.copy_number_or_non_snv,
        discordant_with_history=body.discordant_with_history,
        genotype_inferred_relatedness=body.genotype_inferred_relatedness,
    )
    decisions = governance.evaluate_escalation(ctx, result)
    return EscalationEvaluateResponse(couple_id=couple_id, decisions=decisions)


@router.get("/escalations", response_model=EscalationQueueResponse)
def escalation_queue(principal: QueueReader, governance: GovernanceDep) -> EscalationQueueResponse:
    return EscalationQueueResponse(records=governance.escalation_queue(principal))
