"""Haematology-aid routes (lane A): interpret a CBC (and optionally an HPLC) and read the rule table.

Thin by design: the service comes from `request.app.state.haem` (wired by the controller's app factory). Request bodies
are typed and range-checked by Pydantic, so a nonsense value (a haemoglobin of 5000 g/L) is a 422 before it reaches the
rules. The aid is clinician-facing screening support, never a diagnosis; every response says so. Role gating (clinician
only) is the composition layer's job and is not done here.
"""

from __future__ import annotations

from fastapi import APIRouter, Request

from bayan.haem.models import HaemInterpretation, HaemInterpretRequest, HaemRulesView
from bayan.haem.service import HaemService

router = APIRouter(prefix="/v1/haem", tags=["haem"])


def _haem(request: Request) -> HaemService:
    service: object = getattr(request.app.state, "haem", None)
    if not isinstance(service, HaemService):
        msg = "app.state.haem is not wired to a HaemService"
        raise TypeError(msg)
    return service


@router.post(
    "/interpret", summary="Interpret a CBC, and an HPLC when given, into the closed vocabulary"
)
def interpret(body: HaemInterpretRequest, request: Request) -> HaemInterpretation:
    return _haem(request).interpret(body.cbc, body.hplc)


@router.get("/rules", summary="The rule table with sources and sign-off status")
def rules(request: Request) -> HaemRulesView:
    return _haem(request).rules_view()
