"""Demo-mode routes: personas with ready tokens, the seeded cases, and a resettable demo.

    GET  /v1/demo/personas   the synthetic personas, each with a fresh demo token (demo mode only)
    GET  /v1/demo/cases      the ten seeded scenarios and what each one exercises
    POST /v1/demo/reset      judge role: rebuild every service and reseed (rate limited)

Demo tokens are simulated authentication (see governance README); production would use a real
identity provider. These routes answer 404 when demo mode is off.
"""

from __future__ import annotations

import time
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request

from bayan.api.wiring import build_and_seed
from bayan.compose import services
from bayan.core.contracts import Frozen
from bayan.core.errors import Conflict, NotFound
from bayan.core.types import Principal, Role
from bayan.governance.deps import require_roles
from bayan.governance.models import SessionToken

router = APIRouter(prefix="/v1/demo", tags=["demo"])

Judge = Annotated[Principal, Depends(require_roles(Role.JUDGE))]
RESET_MIN_INTERVAL_SECONDS = 20.0
_last_reset = {"at": 0.0}


class PersonaOut(Frozen):
    id: str
    role: Role
    display_name: str
    description: str
    couple_id: str | None
    token: SessionToken


class ScenarioOut(Frozen):
    couple_id: str
    n: int
    title: str
    summary: str
    relationship: str
    emirate_policy: str
    pathway_target: str
    partner_persona_ids: tuple[str, str]
    synthetic: bool = True


def _demo(request: Request) -> Any:
    demo = getattr(request.app.state, "demo", None)
    if demo is None or not request.app.state.settings.demo_mode:
        raise NotFound("Demo mode is off.")
    return demo


@router.get("/personas", response_model=tuple[PersonaOut, ...])
def personas(request: Request) -> tuple[PersonaOut, ...]:
    demo = _demo(request)
    gov = services(request).governance
    return tuple(
        PersonaOut(
            id=p.id,
            role=p.role,
            display_name=p.display_name,
            description=p.description,
            couple_id=p.couple_id,
            token=gov.issue_demo_token(p.principal, audit=False),
        )
        for p in demo.personas
    )


@router.get("/cases", response_model=tuple[ScenarioOut, ...])
def cases(request: Request) -> tuple[ScenarioOut, ...]:
    demo = _demo(request)
    return tuple(
        ScenarioOut(
            couple_id=s.couple_id,
            n=s.n,
            title=s.title,
            summary=s.summary,
            relationship=s.relationship.value,
            emirate_policy=s.emirate.value,
            pathway_target=s.target,
            partner_persona_ids=(f"{s.couple_id}-a", f"{s.couple_id}-b"),
        )
        for s in demo.scenarios
    )


@router.post("/reset", response_model=dict[str, str])
def reset(request: Request, principal: Judge) -> dict[str, str]:
    _demo(request)
    now = time.monotonic()
    if now - _last_reset["at"] < RESET_MIN_INTERVAL_SECONDS:
        raise Conflict(
            "The demo was reset a moment ago; wait a few seconds.", reason="reset_rate_limited"
        )
    _last_reset["at"] = now
    del principal
    build_and_seed(request.app)
    return {"status": "reset", "data": "synthetic"}
