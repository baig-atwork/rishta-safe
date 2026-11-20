"""Catalogue routes: the condition list and the demonstration panels (lane A).

Thin by design: the service comes from `request.app.state.genetics` (wired by the controller's app factory). The data
is synthetic-prototype demonstration content; every frequency is cited or flagged illustrative and every detection
rate is assumed (see `bayan/genetics/README.md`). Access control is the composition layer's job.
"""

from __future__ import annotations

from fastapi import APIRouter, Request

from bayan.genetics.models import ConditionCatalogue, PanelCatalogue
from bayan.genetics.service import GeneticsService

router = APIRouter(prefix="/v1/catalogue", tags=["catalogue"])


def _genetics(request: Request) -> GeneticsService:
    service: object = getattr(request.app.state, "genetics", None)
    if not isinstance(service, GeneticsService):
        msg = "app.state.genetics is not wired to a GeneticsService"
        raise TypeError(msg)
    return service


@router.get("/conditions", summary="Condition catalogue (synthetic-prototype demonstration data)")
def list_conditions(request: Request) -> ConditionCatalogue:
    return _genetics(request).catalogue()


@router.get("/panels", summary="Demonstration panels with assumed detection rates")
def list_panels(request: Request) -> PanelCatalogue:
    return _genetics(request).panels()
