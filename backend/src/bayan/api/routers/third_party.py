"""Third-party requests and the free-text refusal classifier.

    POST /v1/third-party-requests   ALWAYS 403 and audited, citing Decree-Law 49/2023 Art. 19 to 21
    POST /v1/refusals/classify      deterministic refusal classifier (keyword and pattern matching)

The first endpoint needs no token: an employer or insurer has none. An invalid or missing token is
treated as the anonymous external caller, and the answer is the same refusal.
"""

from __future__ import annotations

from typing import NoReturn

from fastapi import APIRouter

from bayan.core.types import Role
from bayan.governance.deps import CurrentPrincipal, GovernanceDep, OptionalPrincipal
from bayan.governance.schemas import ClassifyBody, ThirdPartyBody
from bayan.governance.third_party import RefusalDecision

router = APIRouter(prefix="/v1", tags=["third party and refusals"])


@router.post(
    "/third-party-requests",
    status_code=403,
    response_model=None,
    responses={403: {"description": "Always refused and logged (RFC 9457 problem details)."}},
)
def third_party_request(
    body: ThirdPartyBody, requester: OptionalPrincipal, governance: GovernanceDep
) -> NoReturn:
    governance.third_party_request(requester, body.couple_id, body.kind)


@router.post("/refusals/classify", response_model=RefusalDecision)
def classify(
    body: ClassifyBody, principal: CurrentPrincipal, governance: GovernanceDep
) -> RefusalDecision:
    """Classify a free-text request. A refusal that cannot be answered safely also notifies a
    counsellor, but only for the caller's own couple."""
    own_couple = (
        body.couple_id
        if principal.role is Role.COUPLE_MEMBER and principal.couple_id == body.couple_id
        else None
    )
    return governance.classify_request(
        body.text, body.locale, actor=principal, couple_id=own_couple
    )
