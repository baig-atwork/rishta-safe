"""Explainer reference endpoints: glossary and the options pane (static, reviewed text).

Unguarded on purpose: this is reference material that contains no couple data. To guard, add a
principal dependency here, in one place, as the other routers do.
"""

from __future__ import annotations

from typing import cast

from fastapi import APIRouter, Request

from bayan.core.contracts import ExplainerDoc
from bayan.core.types import Locale
from bayan.explain.models import GlossaryEntry
from bayan.explain.service import ExplainService

router = APIRouter(prefix="/v1/explain", tags=["explain"])


def _explain(request: Request) -> ExplainService:
    return cast("ExplainService", request.app.state.explain)


@router.get("/glossary", response_model=tuple[GlossaryEntry, ...])
def get_glossary(request: Request, locale: Locale = Locale.EN) -> tuple[GlossaryEntry, ...]:
    return _explain(request).glossary(locale)


@router.get("/options", response_model=ExplainerDoc)
def get_options(request: Request, locale: Locale = Locale.EN) -> ExplainerDoc:
    return _explain(request).options_pane(locale)
