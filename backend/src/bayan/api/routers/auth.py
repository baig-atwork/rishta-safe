"""Auth routes (demo, simulated): `POST /v1/auth/otp/request`, `POST /v1/auth/otp/verify`,
`GET /v1/auth/me`. Not production authentication; see `bayan.governance.auth`."""

from __future__ import annotations

from fastapi import APIRouter

from bayan.governance.deps import CurrentPrincipal, GovernanceDep
from bayan.governance.models import DEMO_AUTH_NOTICE, OtpChallenge, SessionToken
from bayan.governance.schemas import MeResponse, OtpRequestBody, OtpVerifyBody

router = APIRouter(prefix="/v1/auth", tags=["auth (demo, simulated)"])


@router.post("/otp/request", response_model=OtpChallenge)
def request_otp(body: OtpRequestBody, governance: GovernanceDep) -> OtpChallenge:
    """Simulated: nothing is delivered. In demo mode the code is in the response."""
    return governance.request_otp(body.channel, body.target)


@router.post("/otp/verify", response_model=SessionToken)
def verify_otp(body: OtpVerifyBody, governance: GovernanceDep) -> SessionToken:
    return governance.verify_otp(body.challenge_id, body.code)


@router.get("/me", response_model=MeResponse)
def me(principal: CurrentPrincipal) -> MeResponse:
    return MeResponse(principal=principal, notice=DEMO_AUTH_NOTICE)
