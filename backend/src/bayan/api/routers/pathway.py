"""Pathway, referral-task and programme-KPI endpoints (all external systems are simulated)."""

from __future__ import annotations

from typing import Annotated, cast

from fastapi import APIRouter, Depends, Request

from bayan.api.deps import CurrentPrincipal, assert_couple_access, require_roles
from bayan.core.types import Locale, Principal, Role
from bayan.journey.models import PathwayEvent, PathwayView, ProgrammeKpis, ReferralTask
from bayan.journey.service import JourneyService

router = APIRouter(prefix="/v1", tags=["pathway"])

# Aggregate only: the programme operator sees KPIs, never an individual couple.
KpiReader = Annotated[
    Principal,
    Depends(require_roles(Role.PROGRAMME, Role.CLINICIAN, Role.COUNSELLOR, Role.JUDGE)),
]


def _journey(request: Request) -> JourneyService:
    return cast("JourneyService", request.app.state.journey)


@router.get("/couples/{couple_id}/pathway", response_model=PathwayView)
def get_pathway(
    couple_id: str, request: Request, principal: CurrentPrincipal, locale: Locale = Locale.EN
) -> PathwayView:
    assert_couple_access(principal, couple_id, request)
    return _journey(request).pathway(couple_id, locale)


@router.post("/couples/{couple_id}/pathway/events", response_model=PathwayView)
def post_pathway_event(
    couple_id: str,
    event: PathwayEvent,
    request: Request,
    principal: CurrentPrincipal,
    locale: Locale = Locale.EN,
) -> PathwayView:
    """Record a pathway event. Scoped to the caller here, and again by the state machine's role table."""
    assert_couple_access(principal, couple_id, request, write=True)
    return _journey(request).advance(couple_id, event, principal, locale)


@router.get("/couples/{couple_id}/referrals", response_model=tuple[ReferralTask, ...])
def get_referrals(
    couple_id: str, request: Request, principal: CurrentPrincipal
) -> tuple[ReferralTask, ...]:
    assert_couple_access(principal, couple_id, request)
    return _journey(request).referral_tasks(couple_id)


@router.get("/programme/kpis", response_model=ProgrammeKpis)
def get_kpis(request: Request, principal: KpiReader) -> ProgrammeKpis:
    del principal
    return _journey(request).kpis()
