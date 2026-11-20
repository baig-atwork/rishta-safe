"""Reports, results, communication and the counsellor brief (composition routes).

PUT  /v1/couples/{id}/reports              clinician: file the laboratory's interpreted reports (simulated feed)
GET  /v1/couples/{id}/result               any viewer with access: disclosure-filtered, rendered result
GET  /v1/couples/{id}/result/raw           assigned staff and judge: the engine's whole answer
POST /v1/couples/{id}/result/communicate   clinician: record communication, run the escalation triggers
GET  /v1/couples/{id}/brief                assigned staff and judge: the one-page grounded brief
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request

from bayan.compose import (
    CommunicateBody,
    CommunicateResponse,
    CounsellorBrief,
    ResultView,
    build_brief,
    communicate,
    compute,
    result_view,
    services,
)
from bayan.core.contracts import CoupleResult, Frozen, PersonReport
from bayan.core.errors import Invalid
from bayan.core.types import Locale, Principal, Role
from bayan.governance.deps import CurrentPrincipal, GovernanceDep, guard_couple, require_roles

router = APIRouter(prefix="/v1", tags=["result"])

Clinician = Annotated[Principal, Depends(require_roles(Role.CLINICIAN))]
StaffOrJudge = Annotated[
    Principal, Depends(require_roles(Role.COUNSELLOR, Role.CLINICIAN, Role.JUDGE))
]


class ReportsBody(Frozen):
    reports: tuple[PersonReport, ...]


class ReportsFiled(Frozen):
    couple_id: str
    filed: int
    simulated_feed: bool = True
    synthetic: bool = True


@router.put("/couples/{couple_id}/reports", response_model=ReportsFiled)
def put_reports(
    couple_id: str,
    body: ReportsBody,
    request: Request,
    principal: Clinician,
    governance: GovernanceDep,
) -> ReportsFiled:
    guard_couple(request, principal, couple_id, governance, write=True)
    svc = services(request)
    case = svc.journey.get_case(couple_id)
    ids = {m.person_id: m for m in case.members}
    if len(body.reports) != 2 or {r.person_id for r in body.reports} != set(ids):
        raise Invalid("File exactly one report for each of the two members of this couple.")
    for r in body.reports:
        if ids[r.person_id].sex != r.sex:
            raise Invalid("A report's sex does not match the case record.")
    svc.journey.store_reports(couple_id, body.reports)
    return ReportsFiled(couple_id=couple_id, filed=len(body.reports))


@router.get("/couples/{couple_id}/result", response_model=ResultView)
def get_result(
    couple_id: str,
    request: Request,
    principal: CurrentPrincipal,
    governance: GovernanceDep,
    locale: Locale = Locale.EN,
) -> ResultView:
    guard_couple(request, principal, couple_id, governance)
    return result_view(services(request), principal, couple_id, locale)


@router.get("/couples/{couple_id}/result/raw", response_model=CoupleResult)
def get_result_raw(
    couple_id: str, request: Request, principal: StaffOrJudge, governance: GovernanceDep
) -> CoupleResult:
    guard_couple(request, principal, couple_id, governance)
    return compute(services(request), couple_id)[2]


@router.post("/couples/{couple_id}/result/communicate", response_model=CommunicateResponse)
def post_communicate(
    couple_id: str,
    body: CommunicateBody,
    request: Request,
    principal: Clinician,
    governance: GovernanceDep,
) -> CommunicateResponse:
    guard_couple(request, principal, couple_id, governance, write=True)
    return communicate(
        services(request), principal, couple_id, pregnancy=body.pregnancy_in_progress
    )


@router.get("/couples/{couple_id}/brief", response_model=CounsellorBrief)
def get_brief(
    couple_id: str,
    request: Request,
    principal: StaffOrJudge,
    governance: GovernanceDep,
    locale: Locale = Locale.EN,
) -> CounsellorBrief:
    guard_couple(request, principal, couple_id, governance)
    return build_brief(services(request), principal, couple_id, locale)
